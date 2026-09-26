// src/pages/Settings/components/SettingsHeader.jsx
// The house page head for Settings. Kicker, title, lede. No oxford commas,
// no dashes.

import { PageHead } from '../../../components/common/Page';

const SettingsHeader = () => (
  <PageHead
    kicker="Settings"
    title="Your account."
    lede="Your profile, your password and, if you run the place, the team."
  />
);

export default SettingsHeader;
