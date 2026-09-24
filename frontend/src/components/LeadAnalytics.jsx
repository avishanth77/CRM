import {
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    Tooltip,
    Legend,
} from "recharts";

function LeadAnalytics({ data }) {

    const statusData = [
        {
            name: "New",
            value: data?.new_leads ?? 0,
        },
        {
            name: "Contacted",
            value: data?.contacted_leads ?? 0,
        },
        {
            name: "Demo Scheduled",
            value: data?.demo_scheduled ?? 0,
        },
        {
            name: "Negotiation",
            value: data?.negotiation ?? 0,
        },
        {
            name: "Won",
            value: data?.won_leads ?? 0,
        },
        {
            name: "Lost",
            value: data?.lost_leads ?? 0,
        },
    ];

    return (
        <div style={{ width: "100%", height: 350 }}>

            <ResponsiveContainer
                width="100%"
                height="100%"
            >
                <PieChart>

                    <Pie
                        data={statusData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={110}
                        label
                    >
                        {statusData.map(
                            (entry, index) => (
                                <Cell
                                    key={`cell-${index}`}
                                />
                            )
                        )}
                    </Pie>

                    <Tooltip />

                    <Legend />

                </PieChart>
            </ResponsiveContainer>

        </div>
    );
}

export default LeadAnalytics;