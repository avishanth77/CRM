import { useNavigate } from "react-router-dom";
import "../styles/Navbar.css";

function Navbar({ onMenuClick }) {
    const navigate = useNavigate();

    const logout = () => {
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");

        navigate("/login");
    };

    return (
        <header className="navbar">

            <button
                className="menu-button"
                onClick={onMenuClick}
            >
                ☰
            </button>

            <div className="navbar-title">
                CRM Lite
            </div>

            <div className="navbar-right">

                <span className="navbar-user">
                    Admin
                </span>

                <button
                    className="logout-button"
                    onClick={logout}
                >
                    Logout
                </button>

            </div>

        </header>
    );
}

export default Navbar;