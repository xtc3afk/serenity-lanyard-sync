const puppeteer = require("puppeteer");


async function scrapeRocketLeague() {

    const browser = await puppeteer.launch({
        headless: true
    });


    const page = await browser.newPage();


    await page.goto(
        "https://rocketleague.tracker.network/rocket-league/profile/epic/hitselecting/overview",
        {
            waitUntil: "networkidle2"
        }
    );


    const stats = await page.evaluate(() => {


        const text = document.body.innerText;


        return {
            raw: text
        };


    });


    await browser.close();


    return stats;

}


module.exports = {
    scrapeRocketLeague
};