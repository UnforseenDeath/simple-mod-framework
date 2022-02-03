// @ts-ignore
THREE = require("./three-onlymath.min")

const QuickEntity = {
    "0": require("./quickentity1136"),
    "3": require("./quickentity20"),
    "4": require("./quickentity"),
	
    "999": require("./quickentity")
}

const RPKG = require("./rpkg")

const fs = require("fs-extra")
const path = require("path")
const child_process = require("child_process")
const json5 = require("json5")
const chalk = require("chalk")
const LosslessJSON = require("lossless-json")

require("clarify")

const config = json5.parse(String(fs.readFileSync(path.join(process.cwd(), "config.json"))))

module.exports = async ({
	tempHash,
	tempRPKG,
	tbluHash,
	tbluRPKG,
	chunkFolder,
	assignedTemporaryDirectory,
	useNiceLogs,
	patches
}) => {
	let rpkgInstance = new RPKG.RPKGInstance()

	let logger = useNiceLogs ? {
		debug: function (text) {
			process.stdout.write(chalk`{grey DEBUG\t${text}}\n`)
		},
	
		info: function (text) {
			process.stdout.write(chalk`{blue INFO}\t${text}\n`)
		},
	
		error: function (text) {
			process.stderr.write(chalk`{red ERROR}\t${text}\n`)
			console.trace()

			child_process.execSync("pause")
		}
	} : {
		debug: console.debug,
		info: console.info,
		error: function(a) {
			console.error(a)
			console.trace()
		}
	}
	
	fs.ensureDirSync(path.join(process.cwd(), assignedTemporaryDirectory))

	await rpkgInstance.waitForInitialised()
	
	for (let patch of patches) {
		logger.debug("Applying patch " + patch.path)

		if (!QuickEntity[Object.keys(QuickEntity)[Object.keys(QuickEntity).findIndex(a=> parseFloat(a) > Number(patch.patchVersion.value)) - 1]]) {
			rpkgInstance.exit()
			fs.removeSync(path.join(process.cwd(), assignedTemporaryDirectory))
			
			logger.error("Could not find matching QuickEntity version for patch version " + Number(patch.patchVersion.value) + "!")
		}

		fs.writeFileSync(path.join(process.cwd(), assignedTemporaryDirectory, "patch.json"), LosslessJSON.stringify(patch))

		/* ----------------------------------------- Apply patch ---------------------------------------- */
		await (QuickEntity[Object.keys(QuickEntity)[Object.keys(QuickEntity).findIndex(a=> parseFloat(a) > Number(patch.patchVersion.value)) - 1]]).applyPatchJSON(path.join(process.cwd(), assignedTemporaryDirectory, "QuickEntityJSON.json"), path.join(process.cwd(), assignedTemporaryDirectory, "patch.json"), path.join(process.cwd(), assignedTemporaryDirectory, "PatchedQuickEntityJSON.json")) // Patch the QN json
		fs.removeSync(path.join(process.cwd(), assignedTemporaryDirectory, "QuickEntityJSON.json"))
		fs.renameSync(path.join(process.cwd(), assignedTemporaryDirectory, "PatchedQuickEntityJSON.json"), path.join(process.cwd(), assignedTemporaryDirectory, "QuickEntityJSON.json"))
	}

	/* ------------------------------------ Convert to RT Source ------------------------------------ */
	await (QuickEntity[Object.keys(QuickEntity)[Object.keys(QuickEntity).findIndex(a=> parseFloat(a) > Number(patches[0].patchVersion.value)) - 1]]).generate("HM3", path.join(process.cwd(), assignedTemporaryDirectory, "QuickEntityJSON.json"),
		path.join(process.cwd(), assignedTemporaryDirectory, "temp.TEMP.json"),
		path.join(process.cwd(), assignedTemporaryDirectory, "temp.TEMP.meta.json"),
		path.join(process.cwd(), assignedTemporaryDirectory, "temp.TBLU.json"),
		path.join(process.cwd(), assignedTemporaryDirectory, "temp.TBLU.meta.json")) // Generate the RT files from the QN json

	/* -------------------------------------- Convert to binary ------------------------------------- */
	child_process.execSync("\"" + path.join(process.cwd(), "Third-Party", "ResourceTool.exe") + "\" HM3 generate TEMP \"" + path.join(process.cwd(), assignedTemporaryDirectory, "temp.TEMP.json") + "\" \"" + path.join(process.cwd(), assignedTemporaryDirectory, "temp.TEMP") + "\" --simple")
	child_process.execSync("\"" + path.join(process.cwd(), "Third-Party", "ResourceTool.exe") + "\" HM3 generate TBLU \"" + path.join(process.cwd(), assignedTemporaryDirectory, "temp.TBLU.json") + "\" \"" + path.join(process.cwd(), assignedTemporaryDirectory, "temp.TBLU") + "\" --simple")
	await rpkgInstance.callFunction(`-json_to_hash_meta "${path.join(process.cwd(), assignedTemporaryDirectory, "temp.TEMP.meta.json")}"`)
	await rpkgInstance.callFunction(`-json_to_hash_meta "${path.join(process.cwd(), assignedTemporaryDirectory, "temp.TBLU.meta.json")}"`) // Generate the binary files from the RT json

	/* ------------------------------------- Stage binary files ------------------------------------- */
	fs.copyFileSync(path.join(process.cwd(), assignedTemporaryDirectory, "temp.TEMP"), path.join(process.cwd(), "staging", chunkFolder, tempHash + ".TEMP"))
	fs.copyFileSync(path.join(process.cwd(), assignedTemporaryDirectory, "temp.TEMP.meta"), path.join(process.cwd(), "staging", chunkFolder, tempHash + ".TEMP.meta"))
	fs.copyFileSync(path.join(process.cwd(), assignedTemporaryDirectory, "temp.TBLU"), path.join(process.cwd(), "staging", chunkFolder, tbluHash + ".TBLU"))
	fs.copyFileSync(path.join(process.cwd(), assignedTemporaryDirectory, "temp.TBLU.meta"), path.join(process.cwd(), "staging", chunkFolder, tbluHash + ".TBLU.meta")) // Copy the binary files to the staging directory

	fs.removeSync(path.join(process.cwd(), assignedTemporaryDirectory))

	rpkgInstance.exit()

	return
}