"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { Footer as DsFooter } from "@nakamura196/react-ui";

export default function Footer() {
  const t = useTranslations();

  return (
    <DsFooter
      title={t("Common.title")}
      description={t("Common.description")}
      LinkComponent={Link}
      columns={[
        {
          heading: t("Footer.aboutHeading"),
          links: [
            { label: t("Common.help"), href: "/help" },
            { label: t("Changelog.title"), href: "/changelog" },
          ],
        },
        {
          heading: t("Footer.linksHeading"),
          links: [
            {
              label: "GitHub",
              href: "https://github.com/nakamura196/iiif-annotator",
              external: true,
            },
            { label: "IIIF", href: "https://iiif.io/", external: true },
            {
              // nakamura196 が公開している他のツール一覧 (academicpages portfolio)
              label: t("Footer.otherTools"),
              href: "https://nakamura196.github.io/portfolio/",
              external: true,
            },
          ],
        },
      ]}
      copyright={`© ${new Date().getFullYear()} IIIF Annotator`}
    />
  );
}
