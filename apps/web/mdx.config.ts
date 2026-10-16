import remarkFrontmatter from "remark-frontmatter";
import remarkGfm from "remark-gfm";

/** Shared by Vite and the lesson tests, so tests compile lessons exactly like the app. */
export const mdxOptions = {
  // frontmatter: skip the YAML header (metadata comes from the manifest); gfm: tables.
  remarkPlugins: [remarkFrontmatter, remarkGfm],
};
