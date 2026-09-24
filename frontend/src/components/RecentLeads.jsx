
function RecentLeads({ leads = [] }) {
    return (
        <div className="recent-leads">

            {leads.length === 0 ? (
                <p className="empty-message">
                    No recent leads found.
                </p>
            ) : (
                <div className="table-container">

                    <table className="leads-table">

                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Company</th>
                                <th>Status</th>
                                <th>Priority</th>
                                <th>Value</th>
                            </tr>
                        </thead>

                        <tbody>
                            {leads.map((lead) => (
                                <tr key={lead.id}>

                                    <td>
                                        <strong>
                                            {lead.name}
                                        </strong>
                                    </td>

                                    <td>
                                        {lead.company_name || "-"}
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
                                        <span
                                            className={`priority-badge priority-${String(
                                                lead.priority || ""
                                            ).toLowerCase()}`}
                                        >
                                            {lead.priority || "-"}
                                        </span>
                                    </td>

                                    <td>
                                        ₹
                                        {Number(
                                            lead.expected_value || 0
                                        ).toLocaleString("en-IN")}
                                    </td>

                                </tr>
                            ))}
                        </tbody>

                    </table>

                </div>
            )}

        </div>
    );
}

export default RecentLeads;