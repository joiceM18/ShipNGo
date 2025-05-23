/* 
 * /ShipNGo-backend/backend/server.js
 * Main server file using raw Node.js (no Express).
 * Public routes: /tracking, /auth, /index.html, /pages/login.html, /pages/customer_registration.html,
 * /pages/trackingpage.html, and static assets.
 * All other routes require a valid JWT token.
 */

const http = require("http");
const url = require("url");
const fs = require("fs");
const path = require("path");
require("dotenv").config();
const { serveFile, verifyToken, sendJson, readJsonBody } = require("./helpers");

// Import route modules
const authRoutes = require("./routes/auth");

const claimsRoutes = require("./routes/claims");

const deliverpointsRoutes = require("./routes/deliverpoints");

const packageRoutes = require("./routes/packageRoutes");
const trackingRoutes = require("./routes/tracking");

const profileRoutes = require("./routes/profile"); 
const employeeProfileRoutes = require("./routes/employee-profile"); 

const shopRoutes = require("./routes/shop");

const goalsRoutes = require("./routes/goals");
const statusRoutes = require("./routes/status");

const driverRoutes = require("./routes/drivers");
const managerRoutes = require("./routes/manager");

//const alertsRoutes = require('./routes/alerts');
const { getAlerts, clearAlerts } = require("./routes/alerts");

const financeRoutes = require("./routes/financialreport");

const locatoinsRoutes = require("./routes/locations")

const employeesRoutes = require("./routes/employees");


const server = http.createServer(async (req, res) => {
  try {
    const parsedUrl = url.parse(req.url, true);
    req.query = parsedUrl.query;
    const pathname = parsedUrl.pathname;

    // ---- Public Routes (no login required) ----

    // Tracking endpoints are public
    if (pathname.startsWith("/tracking")) {
      if (req.method === "GET" && pathname.startsWith("/tracking/")) {
        const parts = pathname.split("/");
        const trackingId = parts[2];
        await trackingRoutes.getTracking(req, res, trackingId);
        return;
      } else if (req.method === "POST" && pathname === "/tracking") {
        await trackingRoutes.updateTracking(req, res);
        return;
      } 
    }
    // Auth endpoints are public (login, register, auth/me)
    else if (pathname.startsWith("/auth")) {
      if (req.method === "POST" && pathname === "/auth/login") {
        await authRoutes.login(req, res);
        return;
      } else if (req.method === "POST" && pathname === "/auth/register") {
        await authRoutes.register(req, res);
        return;
      } else if (req.method === "GET" && pathname === "/auth/me") {
        await authRoutes.authMe(req, res);
        return;
      } else if (
        req.method === "GET" &&
        (pathname === "/auth/dashboard/customer" || pathname === "/auth/dashboard/employee")
      ) {
        await authRoutes.serveDashboard(req, res);
        return;
      }
    }
    // Homepage, login, registration, tracking page, and static assets are public.
    else if (
      pathname === "/" ||
      pathname === "/index.html" ||
      pathname === "/pages/login.html" ||
      pathname === "/pages/customer_registration.html" ||
      pathname === "/pages/trackingpage.html" ||
      pathname === "/pages/profile.html" ||  

      pathname === "/pages/faq.html" ||
      pathname === "/pages/billing.html" ||
      pathname === "/pages/faq.html" ||

      pathname === "/pages/employee-profile.html" || 

      pathname.endsWith(".css") ||
      pathname.endsWith(".js") ||
      pathname.endsWith(".png") ||
      pathname.endsWith(".jpg") ||
      pathname.endsWith(".jpeg") ||
      pathname.startsWith("/includes/")
    ) {
      const filePath = path.join(__dirname, "../frontend", pathname === "/" ? "index.html" : pathname);
      serveFile(res, filePath);
      return;
    }
    else if (pathname === "/api/whoami") {
      // Simple test endpoint to check authentication and tokenData
      return sendJson(res, 200, { 
        success: true, 
        message: "Authentication working", 
        data: {
          tokenData: req.tokenData,
          message: "If you can see this, authentication is working correctly"
        }
      });
    }

    if (pathname === "/api/alerts" && req.method === "GET") {
      return getAlerts(req, res);
    }
    
    if (pathname === "/api/alerts/clear" && req.method === "POST") {
      return clearAlerts(req, res);
    }

    // ---- Protected Routes (login required) ----
    // All other routes require a valid token.
    const tokenData = verifyToken(req);
    if (!tokenData) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ message: "Unauthorized. Please log in." }));
      return;
    }
    // Attach tokenData to req for use in route modules.
    req.tokenData = tokenData;


    // Now dispatch to protected routes:
    if (pathname.startsWith("/claims")) {
      if (req.method === "GET" && pathname === "/claims") {
        await claimsRoutes.getClaims(req, res);
        return;
      } else if (req.method === "POST" && pathname === "/claims") {
        await claimsRoutes.fileClaim(req, res);
        return;
      }
    }
    else if (pathname.startsWith("/edit")) {
      if (req.method === "PUT" && pathname === "/edit/update_delivery_point_address") {
        await deliverpointsRoutes.updateDeliveryPointAddress(req, res);
        return;
      } else if (req.method === "PUT" && pathname === "/edit/register_delivery_point") {
        await deliverpointsRoutes.registerDeliveryPoint(req, res);
        return;
      }
    }
    else if (pathname.startsWith("/packages")) {
      if (req.method === "GET" && pathname === "/packages/dashboard/employee") {
        await packageRoutes.getPackagesEmployee(req, res, parsedUrl.query);
        return;
      } else if (req.method === "POST" && pathname === "/packages") {
        await packageRoutes.createPackage(req, res);
        return;
      } else if (req.method === "PUT" && pathname.startsWith("/packages/")) {
        const parts = pathname.split("/");
        const id = parts[2];
        await packageRoutes.updatePackage(req, res, id);
        return;
      } else if (req.method === "GET" && pathname === "/packages/customer") {
        await packageRoutes.getPackagesCustomer(req, res);
        return;
      } else if (req.method === "DELETE" && pathname.startsWith("/packages/")) {
        const parts = pathname.split("/");
        const id = parts[2];
        await packageRoutes.deletePackage(req, res, id);
        return;
      }
    }
    if (pathname === "/status" && req.method === "GET") {
      await statusRoutes.status(req, res, parsedUrl.query);
      return;
    }
      
    // Profile routes - added for customer profile management
else if (pathname.startsWith("/api/profile")) {
  // Ensure only customers can access profile routes
  if (tokenData.role !== "customer") {
    return sendJson(res, 403, { 
      success: false, 
      message: "Access denied. Customer access only." 
    });
  }
  
  if (req.method === "GET" && pathname === "/api/profile") {
    await profileRoutes.getProfile(req, res);
    return;
  } else if (req.method === "PUT" && pathname === "/api/profile/update") {
    await profileRoutes.updateProfile(req, res);
    return;
  } else if (req.method === "PUT" && pathname === "/api/profile/change-password") {
    await profileRoutes.changePassword(req, res);
    return;
  }
}
else if (pathname.startsWith("/api/employee-profile")) {
  // Ensure only employees can access profile routes
  if (!(tokenData.role === "employee" || tokenData.role === "manager")) {
    return sendJson(res, 403, { 
      success: false, 
      message: "Access denied. Employee access only." 
    });
  }
  
  if (req.method === "GET" && pathname === "/api/employee-profile") {
    await employeeProfileRoutes.getEmployeeProfile(req, res);
    return;
  } else if (req.method === "PUT" && pathname === "/api/employee-profile/update") {
    await employeeProfileRoutes.updateEmployeeProfile(req, res);
    return;
  } else if (req.method === "PUT" && pathname === "/api/employee-profile/change-password") {
    await employeeProfileRoutes.changePassword(req, res);
    return;
  }
}
    else if (pathname.startsWith("/api/checkout")) {
      if (req.method === "POST" && pathname === "/api/checkout") {
        await shopRoutes.checkout(req, res, parsedUrl.query);
        return;
      }
    }
    else if ((tokenData.role == "manager" || tokenData.role == "employee") && pathname === "/api/employees" && req.method === "GET") {
      await employeesRoutes.getAllEmployees(req, res);
      return;
    }
    else if ((tokenData.role == "manager") && pathname === "/api/employees" && req.method === "POST") {
      await employeesRoutes.createEmployee(req, res);
      return;
    }
    else if (pathname.startsWith("/api/employees/")) {
      const parts = pathname.split("/");
      const id = parts[3];
      if ((tokenData.role == "manager" || tokenData.role == "employee") && req.method === "GET") {
        await employeesRoutes.getEmployeeById(req, res, id);
        return;
      }
      if ((tokenData.role == "manager") && req.method === "PUT") {
        await employeesRoutes.updateEmployee(req, res, id);
        return;
      }
      if ((tokenData.role == "manager") && req.method === "DELETE") {
        await employeesRoutes.deleteEmployee(req, res, id);
        return;
      }
    }
    else if (pathname === "/api/locations") {
      if (req.method === "GET") {
        await locatoinsRoutes.getAllLocations(req, res);
        return;
      } else if ((tokenData.role == "employee" || tokenData.role == "manager") && req.method === "POST") {
        await locatoinsRoutes.createLocation(req, res);
        return;
      }
    } else if ((tokenData.role == "employee" || tokenData.role == "manager") && pathname.startsWith("/api/locations/")) {
      const parts = pathname.split("/");
      const id = parts[3];
      if (req.method === "GET") {
        await locatoinsRoutes.getLocationById(req, res, id);
        return;
      } else if (req.method === "PUT") {
        await locatoinsRoutes.updateLocation(req, res, id);
        return;
      } else if (req.method === "DELETE") {
        await locatoinsRoutes.deleteLocation(req, res, id);
        return;
      }
    } 
    else if (pathname == "/api/stocks" && req.method == "GET"){
      await shopRoutes.getStocks(req, res, parsedUrl.query);
      return;
    }
    else if ((tokenData.role == "employee" || tokenData.role == "manager") && pathname == "/api/restock" && req.method == "POST"){
      await shopRoutes.restock(req, res, parsedUrl.query);
      return;
    }
    else if (tokenData.role == "employee" && pathname.startsWith("/driver")){
      if (req.method === "GET" && pathname === "/driver/get_routes") {
        await driverRoutes.getActiveRoutesByCurrentEmployee(req, res);
        return;
      } else if (req.method === "GET" && pathname.startsWith("/driver/get_stops/")) {
        const parts = pathname.split("/");
        const id = parts[3];
        await driverRoutes.getOrderedStopsForRoute(req, res, id)
        return;
      } else if (req.method === "POST" && pathname == "/driver/add_stop") {
        await driverRoutes.appendStopToRoute(req, res)
        return;
      } else if (req.method === "DELETE" && pathname.startsWith("/driver/delete_stop/")) {
        const parts = pathname.split("/");
        const id = parts[3];
        await driverRoutes.deleteStopFromRoute(req, res, id)
        return;
      }
    }
    else if (pathname === "/goals") {
      // Only allow managers to access goals routes
      if (tokenData.role !== "manager") {
        return sendJson(res, 403, { success: false, message: "Access denied" });
      }
      if (req.method === "GET") {
        await goalsRoutes.getGoals(req, res);
        return;
      } else if (req.method === "POST") {
        await goalsRoutes.postGoals(req, res);
        return;
      }
    }
    else if (tokenData.role === "manager" && pathname.startsWith("/api/claims/")){
        if (req.method === "GET" && pathname === "/api/claims/sumpackage") {
            await financeRoutes.fetchSumPackageTransactions(req,res);
            return;
    }   else if(req.method === "GET" && pathname === "/api/claims/transpackage"){
            await financeRoutes.fetchAllPackageTransactions(req,res);
            return;
    }   else if (req.method === "GET" && pathname === "/api/claims/sum") {
            await financeRoutes.fetchSumTransactions(req,res);
            return;
    }   else if(req.method === "GET" && pathname === "/api/claims/trans"){
            await financeRoutes.fetchAllTransactions(req,res);
            return;
    }   else if (req.method === "GET" && pathname === "/api/claims/suminsure") {
            await financeRoutes.fetchSumInsurance(req,res);
            return;
    }   else if(req.method === "GET" && pathname === "/api/claims/transinsure"){
            await financeRoutes.fetchAllInsuranceTransactions(req,res);
            return;
    }  else if (req.method === "GET" && pathname === "/api/claims/") {
            await managerRoutes.fetchAllClaims(req, res);
            return;
    } else if (req.method === "PUT" && pathname.match(/^\/api\/claims\/[^\/]+\/status$/)) {
        // Extract the ticketId from the URL
        const parts = pathname.split("/");
        const ticketId = parts[3]; // Extract ticketId from the URL pattern
        await managerRoutes.updateClaimStatus(req, res, ticketId);
        return;
    }
  }

    // If no protected route matched, attempt to serve a static file from the frontend folder.
    else {
      const filePath = path.join(__dirname, "../frontend", pathname);
      fs.stat(filePath, (err, stats) => {
        if (!err && stats.isFile()) {
          fs.readFile(filePath, (err, data) => {
            if (err) {
              res.statusCode = 500;
              res.end("Server error");
            } else {
              res.writeHead(200);
              res.end(data);
            }
          });
        } else {
          // Fallback: serve index.html for SPA routing
          const indexFile = path.join(__dirname, "../frontend/index.html");
          fs.readFile(indexFile, (err, data) => {
            if (err) {
              res.statusCode = 500;
              res.end("Server error");
            } else {
              res.writeHead(200, { "Content-Type": "text/html" });
              res.end(data);
            }
          });
        }
      });
    }
  } catch (error) {
    res.statusCode = 500;
    res.end("Server error: " + error.message);
  }
});

// Start server
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});


console.log("DB_HOST:", process.env.DB_HOST);
console.log("JWT_SECRET:", process.env.JWT_SECRET);