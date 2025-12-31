import { Button } from "../ui/button";
import { useState, useEffect } from "react";

function App() {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (event: any) => {
      setMousePosition({ x: event.clientX, y: event.clientY });
    };

    window.addEventListener("mousemove", handleMouseMove);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
    };
  }, []);

  return (
    <Button className="fixed top-4 left-4">
      Mouse Position: {mousePosition.x}, {mousePosition.y}
    </Button>
  );
}

export default App;
