import {
    BrowserRouter,
    Routes,
    Route,
    Navigate,
} from "react-router-dom";

import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";

import ProtectedRoute from "./components/ProtectedRoute";
import DashboardLayout from "./layouts/DashboardLayout";
import Leads from "./pages/Leads";
import CreateLead from "./pages/CreateLead";
import LeadDetails from "./pages/LeadDetails";
import EditLead from "./pages/EditLead";


function App() {
    return (
        <BrowserRouter>

            <Routes>

                {/* Public Route */}

                <Route
                    path="/login"
                    element={<Login />}
                />


                {/* Protected Routes */}

                <Route element={<ProtectedRoute />}>

                    <Route element={<DashboardLayout />}>

                        <Route
                            path="/dashboard"
                            element={<Dashboard />}
                        />

                    </Route>
                  <Route
                      path="/leads"
                      element={<Leads />}
                  />
                                          <Route
                   path="/leads/create"
                    element={<CreateLead />}
                />
                        <Route
                   path="/leads/:id"
                    element={<LeadDetails/>}
                />
                <Route
                        path="/leads/:id/edit"
                        element={<EditLead />}
                    />


                </Route>

                {/* Default Route */}

                <Route
                    path="/"
                    element={
                        <Navigate
                            to="/dashboard"
                            replace
                        />
                    }
                />

            </Routes>

        </BrowserRouter>
    );
}

export default App;