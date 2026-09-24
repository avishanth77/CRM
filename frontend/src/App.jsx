import {
    BrowserRouter,
    Routes,
    Route,
    Navigate,
} from "react-router-dom";

import Dashboard from "./pages/Dashboard";
import DashboardLayout from "./layouts/DashboardLayout";

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