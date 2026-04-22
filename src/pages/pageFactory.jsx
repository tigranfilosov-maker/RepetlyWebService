import { AppLayout } from "../components/AppLayout";

const sharedLayout = {
  stats: 4,
  primaryRows: 4,
  secondaryCards: 3,
};

export function createPage(title, eyebrow) {
  return function Page() {
    return (
      <AppLayout
        title={title}
        eyebrow={eyebrow}
        sectionLayout={sharedLayout}
      />
    );
  };
}
