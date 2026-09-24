import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import {
    getLead,
    deleteLead,
} from "../services/leadsApi";

import "../styles/LeadDetails.css";

function LeadDetails() {
    const { id } = useParams();
    const navigate = useNavigate();

    const [lead, setLead] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [deleting, setDeleting] = useState(false);

    useEffect(() => {
        loadLead();
    }, [id]);

    const loadLead = async () => {
        try {
            setLoading(true);
            setError("");

            const data = await getLead(id);

            setLead(data);
        } catch (err) {
            console.error(
                "Failed to load lead:",
                err
            );

            setError(
                err.message ||
                "Failed to load lead"
            );
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="lead-details-page">
                <div className="lead-details-loading">
                    Loading lead...
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="lead-details-page">

                <button
                    className="back-button"
                    onClick={() => navigate("/leads")}
                >
                    ← Back to Leads
                </button>

                <div className="lead-details-error">
                    {error}
                </div>

            </div>
        );
    }

    if (!lead) {
        return (
            <div className="lead-details-page">

                <button
                    className="back-button"
                    onClick={() => navigate("/leads")}
                >
                    ← Back to Leads
                </button>

                <div className="lead-details-error">
                    Lead not found.
                </div>

            </div>
        );
        
    }
    const handleDelete = async () => {
    const confirmed = window.confirm(
        `Are you sure you want to delete "${lead.name}"?`
    );

    if (!confirmed) {
        return;
    }

    try {
        setDeleting(true);
        setError("");

        await deleteLead(id);

        navigate("/leads");

    } catch (err) {
        console.error(
            "Delete lead error:",
            err
        );

        setError(
            err.message ||
            "Failed to delete lead"
        );

        setDeleting(false);
    }
    };

    return (
        <div className="lead-details-page">

            {/* Header */}

            <div className="lead-details-header">

                <div>

                    <button
                        className="back-button"
                        onClick={() => navigate("/leads")}
                    >
                        ← Back to Leads
                    </button>

                    <h1>
                        {lead.name}
                    </h1>

                    <p>
                        Lead #{lead.id}
                    </p>
<div className="lead-action-buttons">

    <button
        className="edit-lead-button"
        onClick={() =>
            navigate(`/leads/${lead.id}/edit`)
        }
        disabled={deleting}
    >
        Edit Lead
    </button>

    <button
        className="delete-lead-button"
        onClick={handleDelete}
        disabled={deleting}
    >
        {deleting
            ? "Deleting..."
            : "Delete Lead"}
    </button>

</div>
                </div>

            </div>


            {/* Main Content */}

            <div className="lead-details-grid">

                {/* Basic Information */}

                <div className="details-card">

                    <div className="card-header">
                        <h2>
                            Lead Information
                        </h2>
                    </div>

                    <div className="details-list">

                        <div className="detail-item">
                            <span>Name</span>
                            <strong>
                                {lead.name || "-"}
                            </strong>
                        </div>

                        <div className="detail-item">
                            <span>Phone</span>
                            <strong>
                                {lead.phone || "-"}
                            </strong>
                        </div>

                        <div className="detail-item">
                            <span>Email</span>
                            <strong>
                                {lead.email || "-"}
                            </strong>
                        </div>

                        <div className="detail-item">
                            <span>Company</span>
                            <strong>
                                {lead.company_name || "-"}
                            </strong>
                        </div>

                    </div>

                </div>


                {/* Sales Information */}

                <div className="details-card">

                    <div className="card-header">
                        <h2>
                            Sales Information
                        </h2>
                    </div>

                    <div className="details-list">

                        <div className="detail-item">
                            <span>Status</span>

                            <span
                                className={`status-badge status-${String(
                                    lead.status || ""
                                ).toLowerCase()}`}
                            >
                                {lead.status || "-"}
                            </span>
                        </div>


                        <div className="detail-item">
                            <span>Priority</span>

                            <strong>
                                {lead.priority || "-"}
                            </strong>
                        </div>


                        <div className="detail-item">
                            <span>Expected Value</span>

                            <strong>
                                ₹{" "}
                                {Number(
                                    lead.expected_value || 0
                                ).toLocaleString("en-IN")}
                            </strong>
                        </div>


                        <div className="detail-item">
                            <span>Assigned To</span>

                            <strong>
                                {lead.assigned_to_username ||
                                    lead.assigned_to ||
                                    "-"}
                            </strong>
                        </div>

                    </div>

                </div>


                {/* Source */}

                <div className="details-card">

                    <div className="card-header">
                        <h2>
                            Lead Source
                        </h2>
                    </div>

                    <div className="details-list">

                        <div className="detail-item">
                            <span>Source</span>

                            <strong>
                                {lead.source_name ||
                                    lead.source ||
                                    "-"}
                            </strong>
                        </div>

                    </div>

                </div>


                {/* Dates */}

                <div className="details-card">

                    <div className="card-header">
                        <h2>
                            Timeline
                        </h2>
                    </div>

                    <div className="details-list">

                        <div className="detail-item">
                            <span>
                                Created
                            </span>

                            <strong>
                                {lead.created_at
                                    ? new Date(
                                          lead.created_at
                                      ).toLocaleString(
                                          "en-IN"
                                      )
                                    : "-"}
                            </strong>
                        </div>

                        <div className="detail-item">
                            <span>
                                Last Updated
                            </span>

                            <strong>
                                {lead.updated_at
                                    ? new Date(
                                          lead.updated_at
                                      ).toLocaleString(
                                          "en-IN"
                                      )
                                    : "-"}
                            </strong>
                        </div>

                    </div>

                </div>


                {/* Lost Reason */}

                {lead.status === "LOST" &&
                    lead.lost_reason && (
                        <div className="details-card full-width">

                            <div className="card-header">
                                <h2>
                                    Lost Reason
                                </h2>
                            </div>

                            <p className="lost-reason">
                                {lead.lost_reason}
                            </p>

                        </div>
                    )}

            </div>

        </div>
    );
}

export default LeadDetails;