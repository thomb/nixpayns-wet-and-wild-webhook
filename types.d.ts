export enum EMessageType {
  "fight" = "fight",
  "inprogress" = "inprogress",
  "results" = "results"
}

type TMessage<T> = {
  messageType: EMessageType;
  payload: T
}

type TFighter = {
  name: string;
  id: number;
};

type TTeam = {
  id: number;
  fighters: TFighter[];
};

type TBattle = {
  id: number;
  rounds: number;
  teamOne: TTeam;
  teamTwo: TTeam;
  inProgress?: boolean;
  completed?: boolean;
  isReady?: boolean;
  stage?: string;
};



type TIncomingFightMessage = TMessage<{fights: TBattle[]}>

type TInProgressMessage = TMessage<{fight: TBattle}>

type TResultsMessage = TMessage<{
  fight: TBattle;
  resultData: {
    winningTeam: string;
    rawResults: string[] | any;
  }
}>


