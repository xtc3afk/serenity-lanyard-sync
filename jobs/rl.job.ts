const cron = require("node-cron");
const fs = require("fs");

const {
    scrapeRocketLeague
} = require("../services/rocketleague.service");


cron.schedule("0 */2 * * *", async () => {

    console.log(
        "[RocketLeague] Updating stats..."
    );


    try {

        const data = await scrapeRocketLeague();


        fs.writeFileSync(
            "./cache/rocketleague.json",
            JSON.stringify(
                data,
                null,
                4
            )
        );


        console.log(
            "[RocketLeague] Updated!"
        );


    } catch(error) {

        console.error(
            "[RocketLeague]",
            error
        );

    }


});