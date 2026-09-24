import { NavLink } from "react-router-dom";
import "../styles/Sidebar.css";

function Sidebar({ open, onClose }) {
    return (
        <>
            {open && (
                <div
                    className="sidebar-overlay"
                    onClick={onClose}
                />
            )}

            <aside
                className={`sidebar ${
                    open ? "sidebar-open" : ""
                }`}
            >
                <div className="sidebar-logo">
                    <h2>CRM Lite</h2>

                    <button
                        className="sidebar-close"
                        onClick={onClose}
                    >
                        ×
                    </button>
                </div>

                <nav className="sidebar-nav">

                    <NavLink
                        to="/dashboard"
                        onClick={onClose}
                    >
                        📊 Dashboard
                    </NavLink>

                    <NavLink
                        to="/leads"
                        onClick={onClose}
                    >
                        👥 Leads
                    </NavLink>

                    <NavLink
                        to="/customers"
                        onClick={onClose}
                    >
                        🧑‍💼 Customers
                    </NavLink>

                    <NavLink
                        to="/activities"
                        onClick={onClose}
                    >
                        📝 Activities
                    </NavLink>

                    <NavLink
                        to="/followups"
                        onClick={onClose}
                    >
                        📅 Follow-ups
                    </NavLink>

                </nav>
            </aside>
        </>
    );
}

export default Sidebar;