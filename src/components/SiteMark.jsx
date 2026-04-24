import logoImage from "../assets/logo.png";
import { useSiteSettings } from "../site/SiteSettingsContext";

export function SiteMark({ className }) {
  const { siteSettings } = useSiteSettings();

  return (
    <span className={className}>
      <img src={logoImage} alt={siteSettings.brandName || "Repetly"} />
    </span>
  );
}
