// Fails fast when the app is started under a Node version that Prisma 7 and
// the compiled better-sqlite3 driver don't support (e.g. Node 23).
const [major, minor] = process.versions.node.split(".").map(Number);
const supported =
  (major === 20 && minor >= 19) || (major === 22 && minor >= 12) || major === 24 || major >= 26;

if (!supported) {
  console.error(`
  CardVault needs Node.js 20.19+, 22.12+ or 24+. You're running ${process.version}.

  If Node 24 is installed via Homebrew, put it on your PATH:
    echo 'export PATH="/opt/homebrew/opt/node@24/bin:$PATH"' >> ~/.zshrc && exec zsh

  After switching Node versions, run \`npm rebuild better-sqlite3\` if pages fail
  with a NODE_MODULE_VERSION error.
`);
  process.exit(1);
}
