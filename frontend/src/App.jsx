import {
    BrowserRouter,
    Routes,
    Route,
    Navigate,
} from "react-router-dom";

import Dashboard from "./pages/Dashboard";
import DashboardLayout from "./layouts/DashboardLayout";
import Login from "./pages/Login";

function App() {
    return (
        <BrowserRouter>

            <Routes>

                <Route
                    path="/"
                    element={
                        <Navigate to="/dashboard" />
                    }
                />
                           <Route
                    path="/login"
                    element={<Login />}
                />
                <Route element={<DashboardLayout />}>

                    <Route
                        path="/dashboard"
                        element={<Dashboard />}
                    />

                </Route>

                </Routes>
                 

        </BrowserRouter>
    );
}

export default App;