import fs from "fs/promises";

console.log("🚀 Starting build process...");

await fs.rm("./dist", { recursive: true, force: true });
await fs.mkdir("./dist", { recursive: true });

try {
	const result = await Bun.build({
		entrypoints: ["./src/index.ts"],
		outdir: "./dist",
		target: "browser",
		format: "esm",
		minify: true,
		sourcemap: "external",
	});

	if (!result.success) {
		console.error("❌ Build failed:", result.logs);
		process.exit(1);
	}

	console.log("✅ TypeScript compilation complete");

	await fs.cp("./src/index.html", "./dist/index.html");
	await fs.cp("./src/config.js", "./dist/config.js");
	await fs.cp("./src/_headers", "./dist/_headers");

	console.log("🎉 Build complete! Output in ./dist");
} catch (error) {
	console.error("❌ Build error:", error);
	process.exit(1);
}
