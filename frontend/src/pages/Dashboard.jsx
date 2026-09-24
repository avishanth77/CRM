import { useEffect, useState } from "react";
import { getDashboard } from "../services/dashboardApi";
import "../styles/Dashboard.css";

function Dashboard() {
    const [dashboard, setDashboard] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [period, setPeriod] = useState("all");

    useEffect(() => {
        loadDashboard();
    }, [period]);

    const loadDashboard = async () => {
        try {
            setLoading(true);
            setError("");

            const data = await getDashboard(period);

            setDashboard(data);
        } catch (err) {
            console.error(err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="dashboard-loading">
                Loading dashboard...
            </div>
        );
    }

    if (error) {
        return (
            <div className="dashboard-error">
                <h3>Dashboard Error</h3>
                <p>{error}</p>
            </div>
        );
    }

    const summary = dashboard?.summary || {};

    return (
        <div className="dashboard">

            {/* Header */}

            <div className="dashboard-header">

                <div>
                    <h1>CRM Dashboard</h1>

                    <p>
                        Overview of your CRM performance
                    </p>
                </div>

                <select
                    className="dashboard-filter"
                    value={period}
                    onChange={(e) =>
                        setPeriod(e.target.value)
                    }
                >
                    <option value="today">
                        Today
                    </option>

                    <option value="7days">
                        Last 7 Days
                    </option>

                    <option value="30days">
                        Last 30 Days
                    </option>

                    <option value="all">
                        All Time
                    </option>
                </select>

            </div>


            {/* Summary Cards */}

            <div className="dashboard-cards">

                <div className="dashboard-card">
                    <h3>Total Leads</h3>

                    <div className="value">
                        {summary.total_leads ?? 0}
                    </div>
                </div>


                <div className="dashboard-card">
                    <h3>Won Leads</h3>

                    <div className="value">
                        {summary.won_leads ?? 0}
                    </div>
                </div>


                <div className="dashboard-card">
                    <h3>Lost Leads</h3>

                    <div className="value">
                        {summary.lost_leads ?? 0}
                    </div>
                </div>


                <div className="dashboard-card">
                    <h3>Pipeline Value</h3>

                    <div className="value">
                        ₹{summary.pipeline_value ?? 0}
                    </div>
                </div>

            </div>


            {/* Main Dashboard */}

            <div className="dashboard-grid">

                <div className="dashboard-section">

                    <h2>
                        Lead Analytics
                    </h2>

                    <p>
                        Lead statistics will appear here.
                    </p>

                </div>


                <div className="dashboard-section">

                    <h2>
                        Recent Activities
                    </h2>

                    <p>
                        Recent CRM activities will appear here.
                    </p>

                </div>

            </div>

        </div>
    );
}

export default Dashboard;