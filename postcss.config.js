import tailwindcss from "tailwindcss";
import autoprefixer from "autoprefixer";

// Tailwind v3 creates a few PostCSS nodes internally without carrying the
// original input metadata. Vite uses that metadata when rewriting url(...)
// declarations, so restore the source on generated nodes before Vite sees
// the final stylesheet.
function preservePostcssSource() {
  return {
    postcssPlugin: "preserve-postcss-source",
    Once(root) {
      if (!root.source) return;
      root.walk((node) => {
        if (!node.source) node.source = root.source;
      });
    },
  };
}

export default {
  plugins: [tailwindcss(), preservePostcssSource(), autoprefixer()],
};
