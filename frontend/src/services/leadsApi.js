const API_URL = "http://127.0.0.1:8000/api";

export async function getLeads() {
    const accessToken =
        localStorage.getItem("access_token");

    if (!accessToken) {
        throw new Error("Authentication required");
    }

    const response = await fetch(
        `${API_URL}/leads/`,
        {
            method: "GET",

            headers: {
                Authorization:
                    `Bearer ${accessToken}`,
                Accept: "application/json",
            },
        }
    );

    const data = await response.json();

    if (!response.ok) {
        throw new Error(
            data.detail ||
            "Failed to fetch leads"
        );
    }

    return data;
}