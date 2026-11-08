import {test,expect} from "@playwright/test";

test("only the actual playback rate has an active border and background, even after touch/hover",async({page})=>{
  // Exercise the real UI without requiring YouTube network access or credentials.
  await page.addInitScript(()=>{
    class FakeYouTubePlayer {
      constructor(_element,options){
        this.rate=1;
        this.events=options.events;
        window.__fakeYouTubePlayer=this;
        queueMicrotask(()=>this.events.onReady?.());
      }
      getPlaybackRate(){return this.rate;}
      getAvailablePlaybackRates(){return [0.5,1,1.25,1.5];}
      setPlaybackRate(rate){
        this.rate=rate;
        setTimeout(()=>this.events.onPlaybackRateChange?.({data:rate}),0);
      }
      getCurrentTime(){return 0;}
      getDuration(){return 120;}
      getPlayerState(){return 2;}
      seekTo(){}
      pauseVideo(){}
      playVideo(){}
      destroy(){}
    }
    window.YT={Player:FakeYouTubePlayer};
  });
  await page.goto("/");
  await page.locator('[data-tab="setup"]').click();
  await page.locator('[data-tab="match"]').click();
  await page.locator("#modeSelect").selectOption("video");
  await page.locator("#youtubeUrl").fill("https://youtu.be/dQw4w9WgXcQ");
  await page.locator("#youtubeForm button").first().click();
  await expect(page.locator("#videoMessage")).toContainText("Bereit.");

  await expect(page.locator('#matchVideoHost [data-rate="1"]')).toHaveAttribute("aria-pressed","true");

  const rateHalf=page.locator('#matchVideoHost [data-rate="0.5"]');
  const rateOne=page.locator('#matchVideoHost [data-rate="1"]');
  await rateHalf.click();
  await expect(rateHalf).toHaveAttribute("aria-pressed","true");
  await expect(rateOne).toHaveAttribute("aria-pressed","false");
  await expect(page.locator('#matchVideoHost [data-rate].selected')).toHaveCount(1);

  // A previous button may still be hovered on touch devices. Hover is not a
  // playback state and must never paint the active cyan border.
  await rateOne.hover();
  let styles=await page.evaluate(()=>{
    const active=document.querySelector('#matchVideoHost [data-rate="0.5"]');
    const inactive=document.querySelector('#matchVideoHost [data-rate="1"]');
    return {
      activeBorder:getComputedStyle(active).borderTopColor,
      inactiveBorder:getComputedStyle(inactive).borderTopColor,
      activeBackground:getComputedStyle(active).backgroundColor,
      inactiveBackground:getComputedStyle(inactive).backgroundColor
    };
  });
  expect(styles.inactiveBorder).not.toBe(styles.activeBorder);
  expect(styles.inactiveBackground).not.toBe(styles.activeBackground);

  await rateOne.click();
  await expect(rateOne).toHaveAttribute("aria-pressed","true");
  await expect(rateHalf).toHaveAttribute("aria-pressed","false");
  await expect(page.locator('#matchVideoHost [data-rate].selected')).toHaveCount(1);
  await rateHalf.hover();
  styles=await page.evaluate(()=>{
    const active=document.querySelector('#matchVideoHost [data-rate="1"]');
    const inactive=document.querySelector('#matchVideoHost [data-rate="0.5"]');
    return {
      activeBorder:getComputedStyle(active).borderTopColor,
      inactiveBorder:getComputedStyle(inactive).borderTopColor
    };
  });
  expect(styles.inactiveBorder).not.toBe(styles.activeBorder);

  // The player's asynchronous rate event can also change playback externally.
  await page.evaluate(()=>window.__fakeYouTubePlayer.setPlaybackRate(1.25));
  await expect(page.locator('#matchVideoHost [data-rate="1.25"]')).toHaveAttribute("aria-pressed","true");
  await expect(page.locator('#matchVideoHost [data-rate].selected')).toHaveCount(1);
  expect(await page.evaluate(()=>window.__fakeYouTubePlayer.getPlaybackRate())).toBe(1.25);
});
