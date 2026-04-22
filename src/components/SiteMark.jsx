import { useSiteSettings } from "../site/SiteSettingsContext";
import { RepetlyMarkIcon } from "./icons";

export function SiteMark({ className }) {
  const { siteSettings } = useSiteSettings();

  return (
    <span className={className}>
      {siteSettings.brandAvatar ? (
        <img src={siteSettings.brandAvatar} alt={siteSettings.brandName || "Repetly"} />
      ) : (
        <RepetlyMarkIcon />
      )}
    </span>
  );
}
