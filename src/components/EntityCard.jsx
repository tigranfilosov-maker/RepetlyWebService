import { useNavigate } from "react-router-dom";

function getInitials(name) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function EntityCard({
  entity,
  variant = "default",
  badges = [],
  details = [],
  footer = null,
}) {
  const navigate = useNavigate();

  function handleMessage() {
    navigate(`/messages?userId=${encodeURIComponent(entity.id)}`);
  }

  return (
    <article className={`entity-square-card entity-square-card--${variant}`}>
      <div className="entity-square-card__header">
        <div className="entity-square-card__avatar" aria-hidden="true">
          {entity.avatar ? <img src={entity.avatar} alt="" /> : getInitials(entity.fullName || "RP")}
        </div>
        {entity.status ? <span className="entity-square-card__status">{entity.status}</span> : null}
      </div>

      <div className="entity-square-card__body">
        <div>
          <h3>{entity.fullName}</h3>
          <p>{entity.email}</p>
        </div>

        {badges.length ? (
          <div className="entity-square-card__badges">
            {badges.filter(Boolean).map((badge) => (
              <span key={badge} className="entity-square-card__badge">
                {badge}
              </span>
            ))}
          </div>
        ) : null}

        {details.length ? (
          <dl className="entity-square-card__facts">
            {details.filter(Boolean).map((detail) => (
              <div key={detail.label} className="entity-square-card__fact">
                <dt>{detail.label}</dt>
                <dd>{detail.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}

        {footer}
      </div>

      <button className="entity-square-card__action" type="button" onClick={handleMessage}>
        Написать
      </button>
    </article>
  );
}
