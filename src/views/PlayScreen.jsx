import React, { useEffect, useState, useRef } from "react";
import { io } from "socket.io-client";
import { Buffer } from "buffer";
import PlayerCard from "../components/PlayerCard";
import WordBar from "../components/WordBar";
import { useNavigate, useLocation } from "react-router-dom";

function PlayScreen() {
  const canvasRef = useRef(null);
  const [isPainting, setIsPainting] = useState(false);
  const [mousePosition, setMousePosition] = useState(undefined);
  const [color, setColor] = useState("#000000");
  const [startPoint, setStartPoint] = useState(null);
  const [lines, setLines] = useState([]);
  const [straightLineMode, setStraightLineMode] = useState(false);
  const [radius, setRadius] = useState(5);
  const [isEraser, setIsEraser] = useState(false);
  const [inputMessage, setInputMessage] = useState("");
  const [allChats, setAllChats] = useState([]);
  const [allPlayers, setAllPlayer] = useState([]);
  const [socket, setSocket] = useState(null);
  const [currentUserDrawing, setCurrentUserDrawing] = useState(false);
  const [gameStarted, setgameStarted] = useState(false);
  const [playerDrawing, setPlayerDrawing] = useState(null);
  const [showWords, setShowWords] = useState(false);
  const [words, setWords] = useState([]);
  const [selectedWord, setSelectedWord] = useState(null);
  const [showClock, setShowClock] = useState(false);
  const [wordLen, setWordLen] = useState(0);
  const [guessedWord, setGuessedWord] = useState(false);
  const [currentRoomCode, setCurrentRoomCode] = useState("");
  const [hostId, setHostId] = useState("");

  const navigate = useNavigate();
  const location = useLocation();
  const userDataRecieved = location.state || {};
  // Sửa dòng 25: Thay domain Azure App Service Backend của bạn vào đây
const ENDPOINT_LOCAL =
  process.env.NODE_ENV === "production"
    ? "skribbl-game-bjc3gwb7dygyg2e2.japaneast-01.azurewebsites.net"
    : "http://localhost:3001";
  // 1. Khởi tạo Socket
  useEffect(() => {
    let us = localStorage.getItem("username");
    if (!us || !userDataRecieved.username || !userDataRecieved.avatar) {
      navigate("/");
      return;
    }

    const newSocket = io.connect(ENDPOINT_LOCAL, {
      transports: ["websocket", "polling"],
    });
    setSocket(newSocket);

    return () => {
      if (newSocket) newSocket.disconnect();
    };
  }, []);

  // 2. Cài đặt các Event Listeners
  useEffect(() => {
    if (!socket) return;

    const handleRoomAssigned = (code) => setCurrentRoomCode(code);
    
    const handleUpdatedPlayers = (data) => {
      if (data.players) {
        setAllPlayer(data.players);
        setHostId(data.hostId);
      } else {
        setAllPlayer(data);
      }
    };

    const handleSendUserData = () => {
      const roomCodeFromHome =
        userDataRecieved.roomCode ||
        userDataRecieved.room ||
        userDataRecieved.code ||
        userDataRecieved.roomId ||
        "";

      socket.emit("recieve-user-data", {
        username: userDataRecieved.username,
        avatar: userDataRecieved.avatar,
        roomCode: roomCodeFromHome,
      });
    };

    const handleReceiving = async (data) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");

      const base64String = data.split(",")[1];
      const buffer = Buffer.from(base64String, "base64");
      const byteArray = new Uint8Array(buffer);
      const blob = new Blob([byteArray], { type: "image/png" });
      const imageUrl = URL.createObjectURL(blob);

      const img = new Image();
      img.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
      };
      img.src = imageUrl;
    };

    const handleGameStart = () => setgameStarted(true);
    const handleGameAlreadyStarted = () => setgameStarted(true);
    const handleGameStop = () => {
      setgameStarted(false);
      setShowClock(false);
      setCurrentUserDrawing(false);
      setPlayerDrawing(null);
    };

    const handleStartTurn = (player) => {
      setGuessedWord(false);
      clearCanvasAfterTurn();
      setPlayerDrawing(player);
      setShowWords(false);
      setCurrentUserDrawing(false);
    };

    const handleReceiveWords = (serverWords) => {
      setWords(serverWords);
      setShowWords(true);
    };

    const handleWordLen = (wl) => setWordLen(wl);

    const handleStartDraw = (player) => {
      setShowWords(false);
      setShowClock(true);
      clearCanvasAfterTurn();
      const isMeDrawing = Boolean(player && socket && player.id === socket.id);
      setCurrentUserDrawing(isMeDrawing);
    };

    const handleEndTurn = (player) => {
      setGuessedWord(false);
      setPlayerDrawing(null);
      setShowClock(false);
      setSelectedWord(null);
      setCurrentUserDrawing(false);
    };

    const handleRecieveChat = ({ msg, player, rightGuess, players }) => {
      setAllPlayer(players);
      if (rightGuess) {
        if (player.id === socket.id) {
          setGuessedWord(true);
          setAllChats((prev) => [
            { sender: "you", message: `you guessed the right word! (${msg})`, rightGuess },
            ...prev,
          ]);
        } else {
          setAllChats((prev) => [
            { sender: player.name, message: `${player.name} guessed the word right!`, rightGuess },
            ...prev,
          ]);
        }
      } else {
        setAllChats((prev) => [
          { sender: player.id === socket.id ? "you" : player.name, message: msg, rightGuess },
          ...prev,
        ]);
      }
    };

    socket.on("room-assigned", handleRoomAssigned);
    socket.on("updated-players", handleUpdatedPlayers);
    socket.on("send-user-data", handleSendUserData);
    socket.on("receiving", handleReceiving);
    socket.on("game-start", handleGameStart);
    socket.on("game-already-started", handleGameAlreadyStarted);
    socket.on("game-stop", handleGameStop);
    socket.on("start-turn", handleStartTurn);
    socket.on("receive-words", handleReceiveWords);
    socket.on("word-len", handleWordLen);
    socket.on("start-draw", handleStartDraw);
    socket.on("end-turn", handleEndTurn);
    socket.on("recieve-chat", handleRecieveChat);

    return () => {
      socket.off("room-assigned", handleRoomAssigned);
      socket.off("updated-players", handleUpdatedPlayers);
      socket.off("send-user-data", handleSendUserData);
      socket.off("receiving", handleReceiving);
      socket.off("game-start", handleGameStart);
      socket.off("game-already-started", handleGameAlreadyStarted);
      socket.off("game-stop", handleGameStop);
      socket.off("start-turn", handleStartTurn);
      socket.off("receive-words", handleReceiveWords);
      socket.off("word-len", handleWordLen);
      socket.off("start-draw", handleStartDraw);
      socket.off("end-turn", handleEndTurn);
      socket.off("recieve-chat", handleRecieveChat);
    };
  }, [socket]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.lineCap = "round";
    ctx.lineWidth = radius;
    ctx.strokeStyle = color;
  }, [color, radius]);

  const startPaint = (event) => {
    if (!currentUserDrawing) return;
    const coordinates = getCoordinates(event);
    if (coordinates) {
      setIsPainting(true);
      setMousePosition(coordinates);
      if (straightLineMode) setStartPoint(coordinates);
    }
  };

  const paint = (event) => {
    if (!isPainting || straightLineMode) return;
    const newMousePosition = getCoordinates(event);
    if (mousePosition && newMousePosition) {
      if (isEraser) eraseLine(newMousePosition);
      else drawLine(newMousePosition);
      setMousePosition(newMousePosition);
    }
  };

  const exitPaint = () => {
    setIsPainting(false);
    setMousePosition(undefined);
    setStartPoint(null);
  };

  const getCoordinates = (event) => {
    if (!canvasRef.current) return null;
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  };

  const drawLine = async (position) => {
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");
    context.strokeStyle = color;
    context.beginPath();
    context.moveTo(mousePosition.x, mousePosition.y);
    context.lineTo(position.x, position.y);
    context.lineWidth = radius;
    context.stroke();

    const dataURL = canvas.toDataURL("image/png");
    socket.emit("sending", dataURL);
    setLines((prev) => [...prev, { start: mousePosition, end: position, color, radius }]);
    setMousePosition(position);
  };

  const handleMouseUp = (event) => {
    if (straightLineMode && startPoint) drawStraightLine(event);
    exitPaint();
  };

  const drawStraightLine = async (event) => {
    if (straightLineMode && startPoint) {
      const endPoint = getCoordinates(event);
      const canvas = canvasRef.current;
      const context = canvas.getContext("2d");

      context.strokeStyle = color;
      context.lineWidth = radius;
      context.beginPath();
      context.moveTo(startPoint.x, startPoint.y);
      context.lineTo(endPoint.x, endPoint.y);
      context.stroke();

      const dataURL = canvas.toDataURL("image/png");
      socket.emit("sending", dataURL);
      setStartPoint(null);
    }
  };

  const eraseLine = async (position) => {
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");
    const imageData = context.getImageData(
      position.x - radius,
      position.y - radius,
      2 * radius,
      2 * radius
    );
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      data[i + 3] = 0;
    }
    context.putImageData(imageData, position.x - radius, position.y - radius);

    const dataURL = canvas.toDataURL("image/png");
    socket.emit("sending", dataURL);
  };

  const fillCanvas = async () => {
    if (!currentUserDrawing) return;
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");
    context.fillStyle = color;
    context.fillRect(0, 0, canvas.width, canvas.height);
    const dataURL = canvas.toDataURL("image/png");
    socket.emit("sending", dataURL);
  };

  const clearCanvas = async () => {
    if (!currentUserDrawing) return;
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");
    context.clearRect(0, 0, canvas.width, canvas.height);
    setLines([]);
    const dataURL = canvas.toDataURL("image/png");
    socket.emit("sending", dataURL);
  };

  const clearCanvasAfterTurn = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const context = canvas.getContext("2d");
      context.clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  const handleSubmitForm = (e) => {
    e.preventDefault();
    if (!inputMessage) return;
    socket.emit("sending-chat", inputMessage.toLowerCase());
    setInputMessage("");
  };

  const handleWorSelect = (w) => {
    setShowWords(false);
    setSelectedWord(w);
    socket.emit("word-select", w);
    setWords([]);
  };

  const handleStartGameClick = () => {
    if (socket) {
      socket.emit("host-start-game");
    }
  };

  const handleSaveDrawing = async () => {
    if (!canvasRef.current) return;
    const imageBase64 = canvasRef.current.toDataURL("image/png");

    try {
      const response = await fetch("/api/upload-drawing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64,
          roomCode: currentRoomCode,
          username: userDataRecieved.username || localStorage.getItem("username") || "Anonymous",
        }),
      });

      const data = await response.json();
      if (response.ok && data.success) {
        alert("🎉 ĐÃ LƯU BỨC TRANH LÊN AZURE BLOB STORAGE!\n\nLink ảnh: " + data.imageUrl);
        if (data.imageUrl) window.open(data.imageUrl, "_blank");
      } else {
        alert("❌ Lỗi: " + (data.message || "Không thể lưu ảnh"));
      }
    } catch (err) {
      console.error(err);
      alert("❌ Lỗi kết nối Server khi lưu ảnh!");
    }
  };

  const basicColors = [
    "#000000", "#FF0000", "#00FF00", "#0000FF", "#FFFF00",
    "#FF00FF", "#00FFFF", "#C0C0C0", "#808080", "#FFFFFF",
  ];

  return (
    <div className="relative w-screen h-screen">
      <div className="w-full h-full flex flex-col justify-center items-center gap-4">
        <div className="flex items-center gap-2 bg-slate-800 text-yellow-400 px-5 py-2 rounded-full border-2 border-yellow-400 shadow-lg">
          <span className="font-bold text-sm tracking-wider">MÃ PHÒNG:</span>
          <span className="text-white font-mono font-extrabold text-xl tracking-widest select-all">
            {currentRoomCode || "Đang kết nối..."}
          </span>
        </div>

        <div>
          <WordBar
            showClock={showClock}
            wordLen={wordLen}
            gameStarted={gameStarted}
            showWords={showWords}
            currentUserDrawing={currentUserDrawing}
            selectedWord={selectedWord}
          />
        </div>

        <div className="w-full flex justify-center items-center gap-10">
          <div className="w-[300px] h-[540px] border border-black bg-white text-black overflow-y-auto">
            {allPlayers &&
              allPlayers.map((pl, idx) => (
                <PlayerCard
                  key={idx}
                  pl={pl}
                  curruser={socket && pl.id === socket.id}
                  playerDrawing={playerDrawing}
                />
              ))}
          </div>

          <div className="w-[680px] h-[540px] relative">
            <canvas
              ref={canvasRef}
              width={680}
              height={540}
              onMouseDown={startPaint}
              onMouseMove={paint}
              onMouseUp={handleMouseUp}
              onMouseLeave={exitPaint}
              className={`border border-black bg-white ${
                currentUserDrawing ? "cursor-crosshair" : "cursor-not-allowed"
              }`}
            />

            {/* 🔥 LOBBY PHÒNG CHỜ VỚI NÚT START GAME */}
            {!gameStarted && (
              <div className="absolute top-0 left-0 w-full h-full bg-slate-900 bg-opacity-90 flex flex-col justify-center items-center text-white z-20 rounded-lg">
                <h2 className="text-3xl font-extrabold mb-4 text-yellow-400">PHÒNG CHỜ</h2>
                <p className="text-gray-300 mb-6">Số người chơi trong phòng: {allPlayers.length}/8</p>

                {socket && socket.id === hostId ? (
                  <button
                    onClick={handleStartGameClick}
                    disabled={allPlayers.length < 2}
                    className={`px-8 py-3 rounded-full font-bold text-lg shadow-lg transition-all ${
                      allPlayers.length >= 2
                        ? "bg-green-500 hover:bg-green-600 text-white cursor-pointer scale-105"
                        : "bg-gray-500 text-gray-300 cursor-not-allowed"
                    }`}
                  >
                    {allPlayers.length >= 2 ? "BẮT ĐẦU TRẬN ĐẤU" : "CẦN TỐI THIỂU 2 NGƯỜI CHƠI..."}
                  </button>
                ) : (
                  <div className="text-xl animate-pulse text-sky-300">
                    Đang chờ Chủ phòng bắt đầu trận đấu...
                  </div>
                )}
              </div>
            )}

            {/* OVERLAY CHỌN TỪ KHAI BẮT ĐẦU LƯỢT */}
            <div>
              {showWords && playerDrawing && socket && playerDrawing.id === socket.id && (
                <div className="absolute top-0 left-0 h-full w-full flex justify-center gap-10 items-center z-10 bg-white bg-opacity-80">
                  {words.map((w, idx) => (
                    <div
                      onClick={() => handleWorSelect(w)}
                      key={idx}
                      className="text-black text-center w-36 h-7 border-2 rounded-md border-black cursor-pointer hover:bg-gray-200"
                    >
                      {w}
                    </div>
                  ))}
                </div>
              )}
              {showWords && playerDrawing && socket && playerDrawing.id !== socket.id && (
                <div className="text-black absolute h-full w-full top-0 left-0 flex justify-center items-center z-10 bg-white bg-opacity-80">
                  {`${playerDrawing.name} is choosing a word`}
                </div>
              )}
            </div>
          </div>

          <div className="w-[300px] h-[540px] border border-black flex flex-col-reverse rounded-b-lg p-1">
            <form onSubmit={handleSubmitForm}>
              <input
                value={inputMessage}
                placeholder="Type your guess here"
                className={`min-w-full active max-w-full text-black flex flex-wrap px-6 py-2 rounded-lg font-medium bg-sky-50 bg-opacity-40 border border-blue-300 placeholder-gray-400 text-md focus:outline-none focus:border-blue-400 focus:bg-white focus:ring-0 focus:shadow-[0_0px_10px_2px_#bfdbfe] ${
                  currentUserDrawing || showWords || !gameStarted ? "cursor-not-allowed" : ""
                }`}
                onChange={(e) => setInputMessage(e.target.value)}
                disabled={currentUserDrawing || showWords || !gameStarted || guessedWord}
              />
            </form>
            <div className="overflow-y-auto flex flex-col-reverse h-full">
              {allChats &&
                allChats.length > 0 &&
                allChats.map((chat, idx) => (
                  <p
                    className={`${chat.rightGuess ? "bg-green-200 text-green-600 font-bold" : ""}`}
                    key={idx}
                  >
                    {chat.rightGuess ? chat.message : `${chat.sender}: ${chat.message}`}
                  </p>
                ))}
            </div>
          </div>
        </div>

        {currentUserDrawing && (
          <div className="flex flex-col items-center gap-2 mt-2">
            <div className="flex justify-center gap-1">
              {basicColors.map((c, index) => (
                <button
                  key={index}
                  style={{ backgroundColor: c }}
                  onClick={() => setColor(c)}
                  className="w-10 h-10 border-2 border-slate-700 rounded-lg cursor-pointer shadow-sm hover:scale-105 transition-transform"
                />
              ))}
            </div>
            <div className="flex justify-center items-center gap-3">
              <button
                className="bg-black text-white px-4 py-2 rounded-lg font-bold hover:bg-gray-800"
                onClick={() => setIsEraser(!isEraser)}
              >
                {isEraser ? "Draw" : "Eraser"}
              </button>
              <button
                className="bg-black text-white px-4 py-2 rounded-lg font-bold hover:bg-gray-800"
                onClick={() => setStraightLineMode(!straightLineMode)}
              >
                {straightLineMode ? "Disable Line" : "Enable Line"}
              </button>
              <button
                className="bg-black text-white px-4 py-2 rounded-lg font-bold hover:bg-gray-800"
                onClick={fillCanvas}
              >
                Fill Canvas
              </button>
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-10 h-10 cursor-pointer"
              />
              <label className="font-bold text-slate-800">Radius:</label>
              <input
                type="range"
                min="1"
                max="100"
                value={radius}
                onChange={(e) => setRadius(parseInt(e.target.value))}
              />
              <button
                className="bg-black text-white px-4 py-2 rounded-lg font-bold hover:bg-gray-800"
                onClick={clearCanvas}
              >
                Clear
              </button>
              <button
                className="bg-emerald-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-emerald-700 shadow-md"
                onClick={handleSaveDrawing}
              >
                Lưu tranh (Azure)
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default PlayScreen;