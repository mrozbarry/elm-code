import Html exposing (Html, div, text)

main =
    Html.program
        { init = init
        , update = update
        , subscriptions = \_ -> Sub.none
        , view = view
        }


type alias Model =
    {}


type Msg = NoOp


init : ( Model, Cmd Msg )
init =
    ( {}
    , Cmd.none
    )


update : Msg -> Model -> ( Model, Cmd Msg )
update msg model =
    case msg of
        NoOp ->
            ( model
            , Cmd.none
            )


view : Model -> Html Msg
view model =
    div
        []
        [ text "Hello from Elm and Elm-Code!"
        ]
