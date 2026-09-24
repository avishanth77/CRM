
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/Login.css";

function Login() {
    const navigate = useNavigate();

    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const handleSubmit = async (e) => {
        e.preventDefault();

        setError("");
        setLoading(true);

        try {
            const response = await fetch(
                "http://127.0.0.1:8000/api/auth/login/",
                {
                    method: "POST",

                    headers: {
                        "Content-Type": "application/json",
                        Accept: "application/json",
                    },

                    body: JSON.stringify({
                        username: username.trim(),
                        password: password,
                    }),
                }
            );

            /*
             * Read the response as text first.
             *
             * This prevents:
             * Unexpected token '<',
             * "<!DOCTYPE..." is not valid JSON
             */
            const responseText = await response.text();

            console.log("Login status:", response.status);
            console.log("Login response:", responseText);

            let data = null;

            /*
             * Try to convert the response into JSON.
             */
            try {
                data = JSON.parse(responseText);
            } catch {
                throw new Error(
                    `Server returned a non-JSON response (${response.status}). ` +
                    `Check the Django login URL.`
                );
            }

            /*
             * Django returned an error.
             */
            if (!response.ok) {
                throw new Error(
                    data.detail ||
                    data.non_field_errors?.[0] ||
                    data.username?.[0] ||
                    data.password?.[0] ||
                    "Invalid username or password."
                );
            }

            /*
             * Make sure JWT tokens exist.
             */
            if (!data.access || !data.refresh) {
                throw new Error(
                    "Login response does not contain access and refresh tokens."
                );
            }

            /*
             * Save JWT tokens.
             */
            localStorage.setItem(
                "access_token",
                data.access
            );

            localStorage.setItem(
                "refresh_token",
                data.refresh
            );

            console.log("Login successful");

            /*
             * Go to dashboard.
             */
            navigate("/dashboard", {
                replace: true,
            });

        } catch (error) {
            console.error("Login error:", error);

            setError(
                error.message ||
                "Unable to login. Please try again."
            );

        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-page">

            <div className="login-card">

                <div className="login-header">

                    <h1>CRM Lite</h1>

                    <p>
                        Sign in to your account
                    </p>

                </div>


                {error && (
                    <div className="login-error">
                        {error}
                    </div>
                )}


                <form
                    className="login-form"
                    onSubmit={handleSubmit}
                >

                    {/* Username */}

                    <div className="form-group">

                        <label htmlFor="username">
                            Username
                        </label>

                        <input
                            id="username"
                            type="text"
                            value={username}
                            onChange={(e) =>
                                setUsername(e.target.value)
                            }
                            placeholder="Enter username"
                            autoComplete="username"
                            disabled={loading}
                            required
                        />

                    </div>


                    {/* Password */}

                    <div className="form-group">

                        <label htmlFor="password">
                            Password
                        </label>

                        <input
                            id="password"
                            type="password"
                            value={password}
                            onChange={(e) =>
                                setPassword(e.target.value)
                            }
                            placeholder="Enter password"
                            autoComplete="current-password"
                            disabled={loading}
                            required
                        />

                    </div>


                    {/* Submit */}

                    <button
                        type="submit"
                        disabled={loading}
                    >
                        {loading
                            ? "Signing in..."
                            : "Sign In"}
                    </button>

                </form>

            </div>

        </div>
    );
}

export default Login;

