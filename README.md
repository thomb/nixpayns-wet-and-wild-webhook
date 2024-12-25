# Nixpayn's Web and Wild Webhook

The name of this repo is a lie, it is just alliterative and amuses me

What this actually is, is a Redis subscriber designed for spawning MUGEN 1.0 fights. Written in Javascript for ease of use by novices, but written with
some typescript support in mind.

This listens to a redis topic for incoming fight requests and will spawn a MUGEN instance for each fight. When the fight is triggered, a POST request
is sent in order to be able to track that a fight is in progress. Upon fight completion the result log is parsed and a POST request is sent with the
data (including lightly parsed raw results data for processing as needed).

The `inprogress` and `results` data would ideally be sent to a separate redis topic instead of a POST message, but the current host implementation
that this was written for was serverless, and as such a redis subscriber on the host end is not practical.

This has no considerations whatsoever beyond a narrow view of functionality

### Environment Variables

```
REDIS_USERNAME="Username for Redis"
REDIS_PASSWORD="Password for the above user"
REDIS_PORT="The port number"
REDIS_HOST="The Redis host (not the webaddress, i.e. not an http value)"
MUGEN="The name of the executable to run"
MUGEN_PATH="The full path to the MUGEN Execurtable, without the name of the executable"
NOSOUND="In case you don't want to hear the fights""
REMOTE_HOST="The Endpoint to recieve the inprogress and results message. This host will need CORS enabled (obviously)."
```

### MUGEN
This requires a version of MUGEN which outputs log files (supported specifically by the `-log` flag) in order to be able to dispatch the results
message.


### Messages

Please refernence the provided `types.d.ts` for the message structures.

`TIncomingFightMessage` is what is recieved to initiate a fight.

`TInProgressMessage` is dispatched when the fight begins.

`TResultsMessage` is dispatched when the fight completes.

#### NOTE on `TResultsMessage`
This will return the `winningteam` as parsed directly from the mugen log. It has no concept of which of the teams in a `TBattle`. The source `TBattle`
is dispatched along with the results message so that this can be reconciled on the host. This is largely just a convenience and might be deprecate
as...

The `rawResults` sent back contains all of the data for each match (lightly parsed, `#####` replaces a newline cuz I wanted it that way). Further data
about the result of the fight can be determined from the raw data, but for now there is an immediate need for `winningteam`

### FUTURE
* Twitch Bot Integration 
  * Send a message when a fight begins, and a fight completes
  * Allow for points to be wagered on a given fight via commands
* Optional delay before starting a fight
  * i.e. to allow for the points to be wagered

### NOT IN SCOPE
* Tournaments
  * Any implementation of a "Tournament" concept will be handled on the host side based on recieving a `results` message
