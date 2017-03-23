module WorkerStatus exposing (..)

import Html exposing (Html, div, text, h3)
import Html.Attributes exposing (class, style)
import Dict exposing (Dict)
import Task exposing (Task)
import Json.Decode
import Firebase
import Firebase.Errors exposing (Error)
import Firebase.Authentication
import Firebase.Authentication.Types exposing (Auth, User)
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
    , isSignedIn : Bool
    }


type alias Job =
    { snippetId : String
    , packageId : String
    , userId : String
    , progress : Maybe Float
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
    in
        { app = app
        , jobs = []
        , isSignedIn = True
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
                            Json.Decode.map
                                (List.map Tuple.second)
                                (Json.Decode.keyValuePairs decodeJob)

                        decodeJob : Json.Decode.Decoder Job
                        decodeJob =
                            Json.Decode.map5
                                Job
                                (Json.Decode.field "snippetId" Json.Decode.string)
                                (Json.Decode.field "packageId" Json.Decode.string)
                                (Json.Decode.field "userId" Json.Decode.string)
                                (Json.Decode.field "progress" (Json.Decode.maybe Json.Decode.float))
                                (Json.Decode.field "state" (Json.Decode.maybe Json.Decode.string))
                    in
                        snapshot
                            |> Firebase.Database.Snapshot.value
                            |> Json.Decode.decodeValue decode
            in
                case decodeJobs of
                    Ok jobs ->
                        ( { model | jobs = jobs }
                        , Cmd.none
                        )

                    Err msg ->
                        ( model
                        , Cmd.none
                        )



-- Views

view : Model -> Html Msg
view model =
    div
        []
        (List.map viewFunction model.jobs)

viewFunction : Job -> Html Msg
viewFunction job =
    let
        progress : Float
        progress =
            Maybe.withDefault 0.0 job.progress
    in
        div
            []
            [ h3 [] [ text job.snippetId ]
            , div
                [ class "progress" ]
                [ div
                    [ class "progress-bar"
                    , style
                        [ ( "width", (toString progress) ++ "%" )
                        ]
                    ]
                    []
                ]
            ]

-- Subscriptions


subscriptions : Model -> Sub Msg
subscriptions model =
    let
        jobReference : Reference
        jobReference =
            model.app
                |> Firebase.Database.init
                |> Firebase.Database.ref (Just "compile-jobs")
    in
        if model.isSignedIn == True then
            Firebase.Database.Reference.on "value" jobReference TasksUpdated
                |> Debug.log "doing sub"
        else
            Sub.none
                |> Debug.log "ignoring sub"
