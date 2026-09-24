import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { createLead } from "../services/leadsApi";

import "../styles/CreateLead.css";

function CreateLead() {
    const navigate = useNavigate();

    const [formData, setFormData] = useState({
        name: "",
        phone: "",
        email: "",
        company_name: "",
        status: "NEW",
        priority: "MEDIUM",
        expected_value: "0",
    });

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const handleChange = (e) => {
        const { name, value } = e.target;

        setFormData((previous) => ({
            ...previous,
            [name]: value,
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        setError("");
        setLoading(true);

        try {
            const createdLead = await createLead({
                ...formData,
                expected_value:
                    Number(formData.expected_value) || 0,
            });

            console.log(
                "Lead created:",
                createdLead
            );

            navigate("/leads");

        } catch (err) {
            console.error(
                "Create lead error:",
                err
            );

            setError(
                err.message ||
                "Failed to create lead"
            );

        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="create-lead-page">

            <div className="create-lead-header">

                <div>
                    <h1>Create Lead</h1>

                    <p>
                        Add a new sales lead
                    </p>
                </div>

                <button
                    type="button"
                    className="back-button"
                    onClick={() => navigate("/leads")}
                >
                    Back to Leads
                </button>

            </div>


            <div className="create-lead-card">

                {error && (
                    <div className="create-lead-error">
                        {error}
                    </div>
                )}


                <form
                    onSubmit={handleSubmit}
                    className="lead-form"
                >

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
                                placeholder="Lead name"
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
                                placeholder="Phone number"
                                required
                            />

                        </div>

                    </div>


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
                                placeholder="Email address"
                            />

                        </div>


                        <div className="form-group">

                            <label>
                                Company
                            </label>

                            <input
                                type="text"
                                name="company_name"
                                value={formData.company_name}
                                onChange={handleChange}
                                placeholder="Company name"
                            />

                        </div>

                    </div>


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
                                value={formData.priority}
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


                    <div className="form-group">

                        <label>
                            Expected Value
                        </label>

                        <input
                            type="number"
                            name="expected_value"
                            value={formData.expected_value}
                            onChange={handleChange}
                            min="0"
                            step="0.01"
                            placeholder="0"
                        />

                    </div>


                    <div className="form-actions">

                        <button
                            type="button"
                            className="cancel-button"
                            onClick={() =>
                                navigate("/leads")
                            }
                            disabled={loading}
                        >
                            Cancel
                        </button>

                        <button
                            type="submit"
                            className="submit-button"
                            disabled={loading}
                        >
                            {loading
                                ? "Creating..."
                                : "Create Lead"}
                        </button>

                    </div>

                </form>

            </div>

        </div>
    );
}

export default CreateLead;