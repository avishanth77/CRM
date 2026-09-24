function RecentActivities({ activities = [] }) {
    if (!activities.length) {
        return (
            <div className="activity-empty">
                No recent activities found.
            </div>
        );
    }

    return (
        <div className="activities-list">

            {activities.map((activity) => (
                <div
                    className="activity-item"
                    key={activity.id}
                >

                    <div className="activity-icon">
                        {getActivityIcon(activity.activity_type)}
                    </div>

                    <div className="activity-content">

                        <strong>
                            {activity.activity_type || "Activity"}
                        </strong>

                        <p>
                            {activity.description || "-"}
                        </p>

                        <small>
                            {activity.created_at
                                ? new Date(
                                      activity.created_at
                                  ).toLocaleString("en-IN")
                                : "-"}
                        </small>

                    </div>

                </div>
            ))}

        </div>
    );
}

function getActivityIcon(type) {
    switch (type) {
        case "CALL":
            return "📞";

        case "EMAIL":
            return "✉️";

        case "MEETING":
            return "📅";

        case "NOTE":
            return "📝";

        default:
            return "📌";
    }
}

export default RecentActivities;