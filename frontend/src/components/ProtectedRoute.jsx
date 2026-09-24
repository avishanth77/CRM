import {
    BrowserRouter,
    Routes,
    Route,
    Navigate,
} from "react-router-dom";

import Dashboard from "./pages/Dashboard";
import Login from "./pages/Login";

import DashboardLayout from "./layouts/DashboardLayout";
import ProtectedRoute from "./components/ProtectedRoute";

function App() {
    return (
        <BrowserRouter>

            <Routes>

                {/* Public */}

                <Route
                    path="/login"
                    element={<Login />}
                />

                {/* Protected */}

                <Route element={<ProtectedRoute />}>

                    <Route element={<DashboardLayout />}>

                        <Route
                            path="/dashboard"
                            element={<Dashboard />}
                        />

                    </Route>

                </Route>


                {/* Default */}

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