function UpcomingFollowUps({ followups = [] }) {
    if (!followups.length) {
        return (
            <div className="followup-empty">
                No upcoming follow-ups.
            </div>
        );
    }

    return (
        <div className="followups-list">

            {followups.map((followup) => (
                <div
                    className="followup-item"
                    key={followup.id}
                >

                    <div className="followup-date">

                        <strong>
                            {formatDate(
                                followup.scheduled_at
                            )}
                        </strong>

                        <span>
                            {formatTime(
                                followup.scheduled_at
                            )}
                        </span>

                    </div>

                    <div className="followup-content">

                        <strong>
                            {followup.follow_up_type ||
                                "TASK"}
                        </strong>

                        <p>
                            {followup.notes || "-"}
                        </p>

                    </div>

                    <span
                        className={`followup-status status-${String(
                            followup.status || ""
                        ).toLowerCase()}`}
                    >
                        {followup.status || "PENDING"}
                    </span>

                </div>
            ))}

        </div>
    );
}

function formatDate(date) {
    if (!date) return "-";

    return new Date(date).toLocaleDateString(
        "en-IN",
        {
            day: "2-digit",
            month: "short",
            year: "numeric",
        }
    );
}

function formatTime(date) {
    if (!date) return "-";

    return new Date(date).toLocaleTimeString(
        "en-IN",
        {
            hour: "2-digit",
            minute: "2-digit",
        }
    );
}

export default UpcomingFollowUps;