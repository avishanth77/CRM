import { useState } from "react";
import { Outlet } from "react-router-dom";

import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";

import "../styles/Layout.css";

function DashboardLayout() {
    const [sidebarOpen, setSidebarOpen] = useState(false);

    return (
        <div className="app-layout">

            <Sidebar
                open={sidebarOpen}
                onClose={() => setSidebarOpen(false)}
            />

            <Navbar
                onMenuClick={() => setSidebarOpen(true)}
            />

            <main className="main-content">
                <Outlet />
            </main>

        </div>
    );
}

export default DashboardLayout;