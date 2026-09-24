const API_URL = "http://127.0.0.1:8000/api";

function getToken() {
    return localStorage.getItem("access_token");
}

async function handleResponse(response) {
    const text = await response.text();

    let data = {};

    try {
        data = text ? JSON.parse(text) : {};
    } catch {
        throw new Error(
            `Server returned an invalid response (${response.status})`
        );
    }

    if (!response.ok) {
        const errorMessage =
            data.detail ||
            data.non_field_errors?.[0] ||
            Object.values(data)
                .flat()
                .find((value) => typeof value === "string") ||
            "Request failed";

        throw new Error(errorMessage);
    }

    return data;
}

export async function getLeads() {
    const token = getToken();

    if (!token) {
        throw new Error("Authentication required");
    }

    const response = await fetch(
        `${API_URL}/leads/`,
        {
            method: "GET",
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/json",
            },
        }
    );

    return handleResponse(response);
}

export async function getLead(id) {
    const token = getToken();

    if (!token) {
        throw new Error("Authentication required");
    }

    const response = await fetch(
        `${API_URL}/leads/${id}/`,
        {
            method: "GET",
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/json",
            },
        }
    );

    return handleResponse(response);
}

export async function createLead(leadData) {
    const token = getToken();

    if (!token) {
        throw new Error("Authentication required");
    }

    const response = await fetch(
        `${API_URL}/leads/`,
        {
            method: "POST",

            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
                Accept: "application/json",
            },

            body: JSON.stringify(leadData),
        }
    );

    return handleResponse(response);
}