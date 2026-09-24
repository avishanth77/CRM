import { useEffect, useState } from "react";

import { getLeads } from "../services/leadsApi";

import "../styles/Leads.css";

function Leads() {
    const [leads, setLeads] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        loadLeads();
    }, []);

    const loadLeads = async () => {
        try {
            setLoading(true);
            setError("");

            const data = await getLeads();

            /*
             * DRF pagination returns:
             *
             * {
             *   count: ...,
             *   next: ...,
             *   previous: ...,
             *   results: [...]
             * }
             */

            if (Array.isArray(data)) {
                setLeads(data);
            } else {
                setLeads(data.results || []);
            }

        } catch (err) {
            console.error(
                "Failed to load leads:",
                err
            );

            setError(err.message);

        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="leads-page">
                <div className="leads-loading">
                    Loading leads...
                </div>
            </div>
        );
    }

    return (
        <div className="leads-page">

<div className="leads-header">

    <div>
        <h1>Leads</h1>

        <p>
            Manage your sales leads
        </p>
    </div>

    <div className="leads-header-actions">

        <button
            className="create-lead-button"
            onClick={() =>
                window.location.href = "/leads/create"
            }
        >
            + Create Lead
        </button>

        <button
            className="refresh-button"
            onClick={loadLeads}
        >
            Refresh
        </button>

    </div>

</div>


            {error && (
                <div className="leads-error">
                    {error}
                </div>
            )}


            <div className="leads-card">

                {leads.length === 0 ? (

                    <div className="empty-leads">
                        No leads found.
                    </div>

                ) : (

                    <div className="table-container">

                        <table>

                            <thead>
                                <tr>
                                    <th>ID</th>
                                    <th>Name</th>
                                    <th>Phone</th>
                                    <th>Email</th>
                                    <th>Status</th>
                                    <th>Priority</th>
                                    <th>Assigned To</th>
                                </tr>
                            </thead>

                            <tbody>

                                {leads.map((lead) => (

                                    <tr key={lead.id}>

                                        <td>
                                            {lead.id}
                                        </td>

                                        <td>
                                            <strong>
                                                {lead.name}
                                            </strong>
                                        </td>

                                        <td>
                                            {lead.phone || "-"}
                                        </td>

                                        <td>
                                            {lead.email || "-"}
                                        </td>

                                        <td>
                                            <span
                                                className={`status-badge status-${String(
                                                    lead.status || ""
                                                ).toLowerCase()}`}
                                            >
                                                {lead.status || "-"}
                                            </span>
                                        </td>

                                        <td>
                                            {lead.priority || "-"}
                                        </td>

                                        <td>
                                            {lead.assigned_to_username ||
                                                lead.assigned_to ||
                                                "-"}
                                        </td>

                                    </tr>

                                ))}

                            </tbody>

                        </table>

                    </div>

                )}

            </div>

        </div>
    );
}

export default Leads;