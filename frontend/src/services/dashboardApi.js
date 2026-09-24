const API_URL = "http://127.0.0.1:8000/api";

export const getDashboard = async (period = "all") => {

    const token = localStorage.getItem("access_token");

    if (!token) {
        throw new Error(
            "No access token found. Please login."
        );
    }

    const response = await fetch(
        `${API_URL}/dashboard/?period=${period}`,
        {
            method: "GET",

            headers: {
                "Content-Type": "application/json",

                Authorization: `Bearer ${token}`,
            },
        }
    );

    if (!response.ok) {

        const errorData =
            await response.json().catch(() => ({}));

        throw new Error(
            errorData.detail ||
            `Dashboard request failed: ${response.status}`
        );
    }

    return response.json();
};