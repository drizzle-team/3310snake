import React, {useEffect, useRef, useState} from "react";
import {createRoom} from "../../api/leaderboard.ts";

interface Props {
  open: boolean
  onClose: () => void;
  isLoggedIn: boolean
}

const CreateRoomModal: React.FC<Props> = ({open, onClose, isLoggedIn}) => {
  const dialogRef = useRef<any>();
  const contentRef = useRef<any>();
  const [name, setName] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [isSubmitted, setIsSubmitted] = useState(false);

  useEffect(() => {
    if (open) {
      dialogRef.current?.showModal();
    } else {
      setName('');
      setError('');
      setIsSubmitted(false);
      dialogRef.current?.close();
    }
  }, [open]);

  const handleClose = (e: any) => {
    if (!contentRef.current.contains(e.target)) {
      onClose()
    }
  }

  const handleSubmit = async () => {
    try {
      if (!name) {
        setError("Room name is required");
      }
      if (!error) {
        await createRoom(name);
        window.location.href = `/${name}`
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
       setIsSubmitted(true);
    }
  };

  const handleOnChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setName(value);
    const pattern = /^[a-zA-Z0-9-_]+$/;
    if (!value) {
      setError("Room name is required");
      return;
    }
    if (value.length > 36) {
      setError("Max length is 36");
      return;
    }
    if (!pattern.test(value)) {
      setError("Room name can only contain letters, numbers, underscores (_), and hyphens (-)");
      return;
    }
    setError("");
  }

  return (
    <dialog
      ref={dialogRef}
      className="dialog"
      onClick={handleClose}
    >
      <div ref={contentRef} className="dialog-content">
        {isLoggedIn ? (
          <>
            <div style={{marginBottom: '16px', fontSize: '18px'}}>Create company room</div>
            <input
              value={name}
              className="input"
              placeholder="Room name"
              onChange={handleOnChange}
            />
            {!!error && isSubmitted && (
              <div style={{padding: '0 8px', fontSize: '12px', marginTop: '4px'}}>{error}</div>
            )}
            <div style={{display: "flex", justifyContent: "flex-end", alignItems: "center", gap: '12px', marginTop: '12px'}}>
              <div onClick={onClose} className="dialog-button">Close</div>
              <div
                style={error && isSubmitted ? {textDecoration: 'none', color: '#555', pointerEvents: 'none'} : {}}
                onClick={handleSubmit}
                className="dialog-button"
              >
                Create
              </div>
            </div>
          </>
        ) : (
          <>
            <div>Sign in to create your company room</div>
            <div style={{display: "flex", justifyContent: "flex-end", alignItems: "center", gap: '12px', marginTop: '12px'}}>
              <div onClick={onClose} className="dialog-button">Close</div>
            </div>
          </>
        )}
      </div>
    </dialog>
  );
}

export default CreateRoomModal;