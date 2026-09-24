const API_URL = "http://127.0.0.1:8000/api";

async function refreshAccessToken() {
    const refreshToken =
        localStorage.getItem("refresh_token");

    if (!refreshToken) {
        return null;
    }

    const response = await fetch(
        `${API_URL}/auth/token/refresh/`,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                refresh: refreshToken,
            }),
        }
    );

    if (!response.ok) {
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");

        return null;
    }

    const data = await response.json();

    localStorage.setItem(
        "access_token",
        data.access
    );

    return data.access;
}


export async function getDashboard(period = "all") {
    let accessToken =
        localStorage.getItem("access_token");

    let response = await fetch(
        `${API_URL}/dashboard/?period=${period}`,
        {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
            },
        }
    );


    // Access token expired
    if (response.status === 401) {

        accessToken =
            await refreshAccessToken();

        if (!accessToken) {
            window.location.href = "/login";
            throw new Error(
                "Session expired. Please login again."
            );
        }


        // Retry request with new token
        response = await fetch(
            `${API_URL}/dashboard/?period=${period}`,
            {
                headers: {
                    Authorization:
                        `Bearer ${accessToken}`,
                    "Content-Type":
                        "application/json",
                },
            }
        );
    }


    if (!response.ok) {
        const errorData =
            await response.json().catch(() => ({}));

        throw new Error(
            errorData.detail ||
            "Failed to load dashboard"
        );
    }

    return response.json();
}