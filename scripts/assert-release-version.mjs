import packageJson from "../package.json" with { type: "json" };

const tagName = process.env.GITHUB_REF_NAME;

if (!tagName) {
  console.error("GITHUB_REF_NAME is required.");
  process.exit(1);
}

const expectedTagName = `v${packageJson.version}`;

if (tagName !== expectedTagName) {
  console.error(
    `Release tag ${tagName} does not match package.json version ${packageJson.version}. Expected ${expectedTagName}.`,
  );
  process.exit(1);
}

console.log(`Release tag matches package version: ${expectedTagName}`);
