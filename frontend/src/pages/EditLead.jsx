import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import {
    getLead,
    updateLead,
} from "../services/leadsApi";

import "../styles/EditLead.css";

function EditLead() {
    const { id } = useParams();
    const navigate = useNavigate();

    const [formData, setFormData] = useState({
        name: "",
        phone: "",
        email: "",
        company_name: "",
        status: "NEW",
        priority: "MEDIUM",
        expected_value: "0",
        lost_reason: "",
    });

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        loadLead();
    }, [id]);

    const loadLead = async () => {
        try {
            setLoading(true);
            setError("");

            const data = await getLead(id);

            setFormData({
                name: data.name || "",
                phone: data.phone || "",
                email: data.email || "",
                company_name: data.company_name || "",
                status: data.status || "NEW",
                priority: data.priority || "MEDIUM",
                expected_value:
                    data.expected_value || "0",
                lost_reason: data.lost_reason || "",
            });

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

    const handleChange = (e) => {
        const { name, value } = e.target;

        setFormData((previous) => ({
            ...previous,
            [name]: value,
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        try {
            setSaving(true);
            setError("");

            await updateLead(id, {
                name: formData.name,
                phone: formData.phone,
                email: formData.email,
                company_name:
                    formData.company_name,
                status: formData.status,
                priority: formData.priority,
                expected_value:
                    Number(
                        formData.expected_value
                    ) || 0,
                lost_reason:
                    formData.status === "LOST"
                        ? formData.lost_reason
                        : "",
            });

            navigate(`/leads/${id}`);

        } catch (err) {
            console.error(
                "Update lead error:",
                err
            );

            setError(
                err.message ||
                "Failed to update lead"
            );

        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="edit-lead-page">
                <div className="edit-loading">
                    Loading lead...
                </div>
            </div>
        );
    }

    return (
        <div className="edit-lead-page">

            <div className="edit-lead-header">

                <div>
                    <button
                        className="back-button"
                        onClick={() =>
                            navigate(`/leads/${id}`)
                        }
                    >
                        ← Back
                    </button>

                    <h1>
                        Edit Lead
                    </h1>

                    <p>
                        Update lead information
                    </p>
                </div>

            </div>


            <div className="edit-lead-card">

                {error && (
                    <div className="edit-lead-error">
                        {error}
                    </div>
                )}


                <form
                    onSubmit={handleSubmit}
                    className="edit-lead-form"
                >

                    {/* Name + Phone */}

                    <div className="form-row">

                        <div className="form-group">

                            <label>
                                Name *
                            </label>

                            <input
                                type="text"
                                name="name"
                                value={formData.name}
                                onChange={handleChange}
                                required
                            />

                        </div>


                        <div className="form-group">

                            <label>
                                Phone *
                            </label>

                            <input
                                type="text"
                                name="phone"
                                value={formData.phone}
                                onChange={handleChange}
                                required
                            />

                        </div>

                    </div>


                    {/* Email + Company */}

                    <div className="form-row">

                        <div className="form-group">

                            <label>
                                Email
                            </label>

                            <input
                                type="email"
                                name="email"
                                value={formData.email}
                                onChange={handleChange}
                            />

                        </div>


                        <div className="form-group">

                            <label>
                                Company
                            </label>

                            <input
                                type="text"
                                name="company_name"
                                value={
                                    formData.company_name
                                }
                                onChange={handleChange}
                            />

                        </div>

                    </div>


                    {/* Status + Priority */}

                    <div className="form-row">

                        <div className="form-group">

                            <label>
                                Status
                            </label>

                            <select
                                name="status"
                                value={formData.status}
                                onChange={handleChange}
                            >

                                <option value="NEW">
                                    New
                                </option>

                                <option value="CONTACTED">
                                    Contacted
                                </option>

                                <option value="DEMO_SCHEDULED">
                                    Demo Scheduled
                                </option>

                                <option value="NEGOTIATION">
                                    Negotiation
                                </option>

                                <option value="WON">
                                    Won
                                </option>

                                <option value="LOST">
                                    Lost
                                </option>

                            </select>

                        </div>


                        <div className="form-group">

                            <label>
                                Priority
                            </label>

                            <select
                                name="priority"
                                value={
                                    formData.priority
                                }
                                onChange={handleChange}
                            >

                                <option value="LOW">
                                    Low
                                </option>

                                <option value="MEDIUM">
                                    Medium
                                </option>

                                <option value="HIGH">
                                    High
                                </option>

                            </select>

                        </div>

                    </div>


                    {/* Expected Value */}

                    <div className="form-group">

                        <label>
                            Expected Value
                        </label>

                        <input
                            type="number"
                            name="expected_value"
                            value={
                                formData.expected_value
                            }
                            onChange={handleChange}
                            min="0"
                            step="0.01"
                        />

                    </div>


                    {/* Lost Reason */}

                    {formData.status === "LOST" && (
                        <div className="form-group">

                            <label>
                                Lost Reason
                            </label>

                            <textarea
                                name="lost_reason"
                                value={
                                    formData.lost_reason
                                }
                                onChange={handleChange}
                                rows="4"
                                placeholder="Enter reason..."
                            />

                        </div>
                    )}


                    {/* Actions */}

                    <div className="form-actions">

                        <button
                            type="button"
                            className="cancel-button"
                            onClick={() =>
                                navigate(
                                    `/leads/${id}`
                                )
                            }
                            disabled={saving}
                        >
                            Cancel
                        </button>


                        <button
                            type="submit"
                            className="save-button"
                            disabled={saving}
                        >
                            {saving
                                ? "Saving..."
                                : "Save Changes"}
                        </button>

                    </div>

                </form>

            </div>

        </div>
    );
}

export default EditLead;