// The console badge every GizmoGoody card prints as it loads: its name and
// version, what it does, and where to ask about it (Discussions). This is
// the shared @gizmogoody/card-badge's badge, kept here until that package
// links to Discussions instead of Issues.
export interface BadgeInfo {
  icon: string;
  name: string;
  version: string;
  description: string;
  repo: string;
}

const NAVY = "#001689";
const SILVER = "#9ea1a2";
const BASE = "font-family: DejaVu Sans, Verdana, Geneva, sans-serif; padding: 2px 6px; text-shadow: 0 1px 0 rgba(1, 1, 1, 0.3);";

export function printBadge(info: BadgeInfo): void {
  const url = `https://github.com/GizmoGoody/${info.repo}`;
  console.groupCollapsed(
    `%c${info.icon} ${info.name}%cv${info.version}%c by GizmoGoody`,
    `${BASE} background-color: ${NAVY}; color: ${SILVER}; border-radius: 999px 0 0 999px; padding-left: 10px;`,
    `${BASE} background-color: ${SILVER}; color: ${NAVY}; border-radius: 0 999px 999px 0; padding-right: 10px; font-weight: bold;`,
    "font-style: italic; color: inherit;",
  );
  console.log(`%cDescription:%c ${info.description}`, "font-weight: bold;", "font-weight: normal;");
  console.log(`%cGitHub:%c ${url}`, "font-weight: bold;", "font-weight: normal;");
  console.log(`%cDiscussions:%c ${url}/discussions`, "font-weight: bold;", "font-weight: normal;");
  console.groupEnd();
}
