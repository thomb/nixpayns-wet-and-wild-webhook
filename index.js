require('dotenv').config();
const path = require('path');
const fs = require('fs');
const createClient = require('redis').createClient;
const childProcess = require("child_process");


const subscriber = createClient({
  username: process.env.REDIS_USERNAME,
  password: process.env.REDIS_PASSWORD,
  socket: {
    host: process.env.REDIS_HOST,
    port: parseInt(process.env.REDIS_PORT || "0"),
  },
});

subscriber.on("error", (err) => console.log("Redis subscriber Error", err));

const publisher = createClient({
  username: process.env.REDIS_USERNAME,
  password: process.env.REDIS_PASSWORD,
  socket: {
    host: process.env.REDIS_HOST,
    port: parseInt(process.env.REDIS_PORT || "0"),
  },
});

publisher.on("error", (err) => console.log("Redis publisher Error", err));

(async () => {


  const fightQueue = [];
  // TODO: On start up, get a list of `ready` fights

  await publisher.connect();
  await subscriber.connect();

  let isFightInProgress = false;
  await subscriber.subscribe('mugen', async (messageString) => {
    try {
      const message = JSON.parse(messageString);
      switch (message.messageType) {
        case 'fight':
          if (!message?.payload?.fights) {
            throw new Error('Payload contained no fights');
          };

          if (isFightInProgress) {
            fightQueue.push(message);
          }
          isFightInProgress = true;
          await processFight(message.payload.fights);

          for await (const message of fightQueue) {
            await processFight(message.payload.fights);
          }
          isFightInProgress = false;
          break;
        default: 
          console.log(`${message.messageType} is not supported`)
      }

    } catch (err) {
      console.error(err)
    }
  });
})();


const processFight = async (fights) => {
  for await (const fight of fights) {
    await startFight(fight);
  }
}


const startFight = async (fight) => {
  const {
    id,
    rounds,
    stage,
    teamOne,
    teamTwo,
  } = fight;
  console.log('fight',fight);

  if (!id) {
    console.warn('Fight has no ID, results will not be tracked');
  }
  const args = [];
  const players = [];
  let availableFighters = [...teamOne.fighters, ...teamTwo.fighters];
  let playerIndex = 1;
  let fighterIndex = 0;

  if (teamOne?.fighters?.length && teamTwo?.fighters?.length) {
    while (players.length < availableFighters.length) {
      // prettier-ignore
      args.push(`-p${playerIndex} "${teamOne.fighters[fighterIndex].name}"`);
      args.push(`-p${playerIndex}.ai 1`);
      players.push(1);
      playerIndex++;
      // prettier-ignore
      args.push(`-p${playerIndex} "${teamTwo.fighters[fighterIndex].name}"`);
      args.push(`-p${playerIndex}.ai 1`);
      players.push(1);
      playerIndex++;
      fighterIndex++;
    }
  }
  args.push(`-rounds ${rounds}`);
  if (stage !== undefined) {
    args.push(`-s ${stage}`);
  }
  const logLocation = 'results.log';
  args.push(`-log ${logLocation}`)
  if (process.env.NOSOUND === "1") {
    args.push(`-nosound`);
  }

  // Set the fight to inprogress on the database
  const inProgressMessage = {
    messageType: "inProgress",
    payload: {
      fight,
    },
  };

  await publisher.publish("mugen:request", JSON.stringify(inProgressMessage));


   childProcess.execFileSync(process.env.MUGEN, args, {
    cwd: process.env.MUGEN_PATH,
    windowsVerbatimArguments: true,
  });

  // Parse the fight results
  const results = fs.readFileSync(path.join(process.env.MUGEN_PATH, logLocation), "utf8");
  const resultData = parseResults(results);
  const resultsMessage = {
    messageType: "results",
    payload: {
      fight,
      resultData,
    },
  };

  console.log('resultsMessage',resultsMessage);

  await publisher.publish("mugen:request", JSON.stringify(resultsMessage));

}

const parseResults = (resultsData) => {
  const delimiter = "#####"
  const results = resultsData.split("\r\n").map((datum) => {
    if (!Boolean(datum)) return delimiter;
    return datum.split(' = ');
  })

  const winners = {};

  results.forEach((item) =>{ 
    if (item[0] === 'winningteam') {
      if (!winners[item[0]]) {
        winners[item[0]] = 0;
      }
      winners[item[0]]++;
    }
  })

  let winningTeam;
  const wins = 0;
  Object.keys(winners).forEach((team) => {
    if (winners[team] > wins) {
      winningTeam = team;
      wins = winners[team];
    }
  });

  return {
    winningTeam,
    rawResults: results
  };
}
