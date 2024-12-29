require('dotenv').config();


const ALPHA_ARRAY = [
  'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z'
]
const startFightBetting = async (fight) => {

  const {
    teamOne,
    teamTwo,
  } = fight;

  const JWT = process.env.STREAM_ELEMENTS_JWT;

  console.log('process.env.STREAM_ELEMENTS_URL',process.env.STREAM_ELEMENTS_URL);
  const response = await fetch(`${process.env.STREAM_ELEMENTS_URL}channels/me`,   {
    method: 'GET',
    headers: {'Content-Type': 'application/json', Authorization: `Bearer ${JWT}`}
  });
  const channelData = await response.json();

  const options = [teamOne, teamTwo].map((team, index) => {
    const title = team.fighters.map(({name}) => name).join(' and ');
    return {
      title,
      command: ALPHA_ARRAY[index]
    }
  })

  const title = options.map(({title, command}) => `${title} (${command})`).join(' vs ');

  const contestData = {
    title,
    minBet: 1,
    maxBet: 100000,
    duration: parseInt(process.env.FIGHT_START_DELAY_MS || '0') / 60000 || 1,
    options
  }

  const createContestReq =  await fetch(`${process.env.STREAM_ELEMENTS_URL}contests/${channelData._id}`,   {
    method: 'POST',
    headers: {'Content-Type': 'application/json', Authorization: `Bearer ${JWT}`},
    body: JSON.stringify(contestData)
  });

  const createContestData = await createContestReq.json();


  await fetch(`${process.env.STREAM_ELEMENTS_URL}contests/${channelData._id}/${createContestData._id}/start`,   {
    method: 'PUT',
    headers: {'Content-Type': 'application/json', Authorization: `Bearer ${JWT}`}
  });


  return {
    channelId: channelData._id,
    contestId: createContestData._id,
    options: createContestData.options,
  }

}


const selectWinner = async (channelId, contestId, winnerId) => {
  const JWT = process.env.STREAM_ELEMENTS_JWT;

  await fetch(`${process.env.STREAM_ELEMENTS_URL}contests/${channelId}/${contestId}/winner`,   {
    body: JSON.stringify({
      winnerId,
    }),
    method: 'PUT',
    headers: {'Content-Type': 'application/json', Authorization: `Bearer ${JWT}`}
  });
}


module.exports  = { startFightBetting, selectWinner };



