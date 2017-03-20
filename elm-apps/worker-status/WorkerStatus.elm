module Main exposing (..)

import Html exposing (Html, div, text, h3)
import Dict exposing (Dict)
import Task exposing (Task)
import FirebaseConfig
import Firebase
import Firebase.Database
import Firebase.Database.Types exposing (Database, Reference, Query, Snapshot)
import Firebase.Database.Reference
import Firebase.Database.Query
import Firebase.Database.Snapshot


-- Entry


main =
    Html.programWithFlags
        { init = init
        , update = update
        , subscriptions = subscriptions
        , view = view
        }



-- Models


type alias Flags =
    { firebaseApiKey : String
    , firebaseDatabaseURL : String
    }


type alias Model =
    { app : Firebase.App
    , jobs : List Job
    , query : Query
    }


type alias Job =
    { snippetId : String
    , packageId : String
    , userId : String
    , percentage : Maybe Float
    , state : Maybe String
    }



-- Init


init : Flags -> ( Model, Cmd Msg )
init flags =
    ( initialModel flags
    , Cmd.none
    )


initialModel : Flags -> Model
initialModel flags =
    let
        app : Firebase.App
        app =
            Firebase.init
                { apiKey = flags.firebaseApiKey
                , databaseURL = flags.firebaseDatabaseURL
                , authDomain = ""
                , storageBucket = ""
                , messagingSenderId = ""
                }

        database : Database
        database =
            Firebase.Database.init app

        query : Query
        query =
            database
                |> Firebase.Database.Reference.ref (Just "compile-jobs")
                |> Firebase.Database.Reference.orderByKey
    in
        { app = app
        , workerIds = flags.workerIds
        , workerPercentages = Dict.empty
        , query = query
        }



-- Update


type Msg
    = TasksUpdated Snapshot


update : Msg -> Model -> ( Model, Cmd Msg )
update msg model =
    case msg of
        TasksUpdated snapshot ->
            let
                decodeJobs : Result String (List Job)
                decodeJobs =
                    let
                        decode : Json.Decode.Decoder (List Job)
                        decode =
                            Json.map
                                (List.map Tuple.second)
                                Json.Decode.keyValuePairs
                                decode

                        decodeJob : Json.Decode.Decoder Job
                        decodeJob =
                            Json.map5
                                Job
                                (Json.Decode.field "snippetId" Json.Decode.string)
                                (Json.Decode.field "packageId" Json.Decode.string)
                                (Json.Decode.field "userId" Json.Decode.string)
                                (Json.Decode.field "percentage" (Json.Decode.maybe Json.Decode.float))
                                (Json.Decode.field "state" (Json.Decode.maybe Json.Decode.string))
                    in
                        snapshot
                            |> Firebase.Database.Snapshot.value
                            |> Json.Decode decode
            in
                case decodeJobs of
                    Ok jobs ->
                        ( { model | jobs = jobs }
                        , Cmd.none
                        )

                    Err msg ->
                        let
                            _ =
                                Debug.log "TaskUpdated" decodeJob
                        in
                            ( model
                            , Cmd.none
                            )



-- Views

view : Model -> Html Msg
view model =
    div
        []
        [ text "WorkerStatus"
        ]

-- Subscriptions


subscriptions : Model -> Sub Msg
subscriptions model =
    Sub.none
