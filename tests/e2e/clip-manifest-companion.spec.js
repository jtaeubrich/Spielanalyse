import {test,expect} from "@playwright/test";
import {readFile} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";

const fixturePath=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../fixtures/hkn_reference.json");

test("PWA-generated clip manifest is compatible with the Companion format and segments",async({page})=>{
  const game=JSON.parse(await readFile(fixturePath,"utf8"));
  const goal=game.events.find(event=>event.type==="goal"&&event.team===game.ownTeam);
  expect(goal).toBeTruthy();
  game.events=[goal];
  // Video-scouted events use their confirmed realTime as video milliseconds.
  game.isHistorical=false;
  game.isVideoscoutingFile=true;
  await page.goto("/");
  await page.locator('[data-tab="setup"]').click();
  await page.locator("#continueGameInput").setInputFiles({
    name:"companion_manifest_fixture.json",
    mimeType:"application/json",
    buffer:Buffer.from(JSON.stringify(game))
  });
  await page.locator('[data-tab="video"]').click();
  await expect(page.locator("#videoTab")).toHaveClass(/active/);
  await page.locator("details.video-presets-card > summary").click();
  await page.locator("#clipPresetSelect").selectOption("standard-goals-by-player");
  await expect(page.locator("#generatePresetClips")).toBeEnabled();
  await page.locator("#generatePresetClips").click();
  const link=page.locator("#generatedClips a").filter({hasText:"Manifest herunterladen"});
  await expect(link).toBeVisible();
  const [download]=await Promise.all([page.waitForEvent("download"),link.click()]);
  const manifest=JSON.parse(await readFile(await download.path(),"utf8"));

  expect(manifest.format).toBe("handball-match-flow-clip-upload-manifest");
  expect(manifest.version).toBe(1);
  expect(manifest.fileName).toMatch(/_upload_manifest\\.json$/);
  expect(manifest.source.localFileName).toBe(game.video.localFileName);
  expect(manifest.outputs).toHaveLength(1);
  const output=manifest.outputs[0];
  expect(output.fileName).toMatch(/\\.mp4$/);
  expect(output.fileBase+".mp4").toBe(output.fileName);
  expect(output.playlistTargets).toHaveLength(1);
  expect(output.playlistTargets[0]).toMatchObject({
    type:"player",
    key:"player:"+String(goal.pId),
    playerId:String(goal.pId)
  });
  expect(output.segments).toHaveLength(1);
  expect(output.segments[0]).toMatchObject({
    eventId:goal.id,
    eventType:"goal",
    videoTime:goal.realTime/1000,
    start:goal.realTime/1000-4,
    end:goal.realTime/1000+2
  });
});
