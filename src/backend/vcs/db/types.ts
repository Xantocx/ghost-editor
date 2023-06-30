import { LineType } from "@prisma/client";

import { FileProxy } from "./proxies/vcs-proxies/file-proxy";
import { BlockProxy } from "./proxies/vcs-proxies/block-proxy";
import { LineProxy } from "./proxies/vcs-proxies/line-proxy";
import { VersionProxy } from "./proxies/vcs-proxies/version-proxy";
import { TagProxy } from "./proxies/vcs-proxies/tag-proxy";

export { LineType, FileProxy, BlockProxy, LineProxy, VersionProxy, TagProxy }