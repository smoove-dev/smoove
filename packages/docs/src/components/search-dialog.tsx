import { useDocsSearch } from "fumadocs-core/search/client";
import { oramaStaticClient } from "fumadocs-core/search/client/orama-static";
import {
  SearchDialog,
  SearchDialogClose,
  SearchDialogContent,
  SearchDialogHeader,
  SearchDialogIcon,
  SearchDialogInput,
  SearchDialogList,
  SearchDialogOverlay,
  type SharedProps,
} from "fumadocs-ui/components/dialog/search";

// The site is static, so search runs in the browser: the first time the dialog
// opens, the client downloads the index that /api/search was pre-rendered to
// and queries it locally. One client for the page's lifetime keeps that index
// from being fetched twice.
const client = oramaStaticClient({ from: "/api/search" });

export function StaticSearchDialog(props: SharedProps) {
  const { search, setSearch, query } = useDocsSearch({ client });
  return (
    <SearchDialog search={search} onSearchChange={setSearch} isLoading={query.isLoading} {...props}>
      <SearchDialogOverlay />
      <SearchDialogContent>
        <SearchDialogHeader>
          <SearchDialogIcon />
          <SearchDialogInput />
          <SearchDialogClose />
        </SearchDialogHeader>
        <SearchDialogList items={query.data !== "empty" ? query.data : null} />
      </SearchDialogContent>
    </SearchDialog>
  );
}
